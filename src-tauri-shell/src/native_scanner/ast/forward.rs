//! Forward evaluation over caller-ordered, completed bars.
//! The caller retains this evaluator across input pages and owns endpoint eligibility.

use std::collections::VecDeque;

use super::{
    binary_point, cross_point, read_field, AtrState, BinaryOpV1, CrossKindV1, EmaState, EvalBar,
    ExprV1, IndicatorNameV1, LatestRuleOutcome, OhlcvFieldV1, RsiState, SmaState,
};

pub(in crate::native_scanner) struct ForwardRuleEvaluator {
    root: Node,
    max_lookback: usize,
    history: VecDeque<EvalBar>,
}

impl ForwardRuleEvaluator {
    pub(in crate::native_scanner) fn new(expression: &ExprV1) -> Result<Self, String> {
        let mut max_lookback = 0;
        let root = Node::compile(expression, &mut max_lookback)?;
        Ok(Self {
            root,
            max_lookback,
            history: VecDeque::new(),
        })
    }

    pub(in crate::native_scanner) fn advance(&mut self, bar: EvalBar) -> LatestRuleOutcome {
        push_bar(&mut self.history, self.max_lookback, bar);
        outcome(self.root.advance(&bar, &self.history))
    }
}

/// Keeps independent indicator state and one shared OHLCV lookback buffer.
pub(in crate::native_scanner) struct ForwardRuleSet {
    roots: Vec<Node>,
    max_lookback: usize,
    history: VecDeque<EvalBar>,
}

impl ForwardRuleSet {
    pub(in crate::native_scanner) fn new<'a>(
        expressions: impl IntoIterator<Item = &'a ExprV1>,
    ) -> Result<Self, String> {
        let mut max_lookback = 0;
        let roots = expressions
            .into_iter()
            .map(|expression| Node::compile(expression, &mut max_lookback))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Self {
            roots,
            max_lookback,
            history: VecDeque::new(),
        })
    }

    pub(in crate::native_scanner) fn advance(
        &mut self,
        bar: EvalBar,
    ) -> impl Iterator<Item = LatestRuleOutcome> + '_ {
        push_bar(&mut self.history, self.max_lookback, bar);
        let history = &self.history;
        self.roots
            .iter_mut()
            .map(move |root| outcome(root.advance(&bar, history)))
    }
}

fn push_bar(history: &mut VecDeque<EvalBar>, max_lookback: usize, bar: EvalBar) {
    if history.len() > max_lookback {
        history.pop_front();
    }
    history.push_back(bar);
}

fn outcome(value: Option<f64>) -> LatestRuleOutcome {
    LatestRuleOutcome {
        matched: value.is_some_and(|number| number != 0.0),
        value,
    }
}

enum IndicatorState {
    Sma(SmaState),
    Ema(EmaState),
    Rsi(RsiState),
}

impl IndicatorState {
    fn advance(&mut self, value: Option<f64>) -> Option<f64> {
        match self {
            Self::Sma(state) => state.advance(value),
            Self::Ema(state) => state.advance(value),
            Self::Rsi(state) => state.advance(value),
        }
    }
}

enum Node {
    Number(f64),
    Field(OhlcvFieldV1, usize),
    Binary(BinaryOpV1, Box<Node>, Box<Node>),
    Indicator(IndicatorState, Box<Node>),
    Atr(AtrState),
    VolumeSma(SmaState),
    Cross {
        kind: CrossKindV1,
        left: Box<Node>,
        right: Box<Node>,
        previous: (Option<f64>, Option<f64>),
    },
}

impl Node {
    fn compile(expression: &ExprV1, max_lookback: &mut usize) -> Result<Self, String> {
        Ok(match expression {
            ExprV1::Number { value } => Self::Number(*value),
            ExprV1::Field { field, lookback } => {
                *max_lookback = (*max_lookback).max(*lookback);
                Self::Field(*field, *lookback)
            }
            ExprV1::Binary { op, left, right } => Self::Binary(
                *op,
                Box::new(Self::compile(left, max_lookback)?),
                Box::new(Self::compile(right, max_lookback)?),
            ),
            ExprV1::Cross { kind, left, right } => Self::Cross {
                kind: *kind,
                left: Box::new(Self::compile(left, max_lookback)?),
                right: Box::new(Self::compile(right, max_lookback)?),
                previous: (None, None),
            },
            ExprV1::Indicator {
                name,
                period,
                input,
            } => {
                let state = match name {
                    IndicatorNameV1::Atr => return Ok(Self::Atr(AtrState::new(*period))),
                    IndicatorNameV1::VolumeSma => {
                        return Ok(Self::VolumeSma(SmaState::new(*period)))
                    }
                    IndicatorNameV1::Sma => IndicatorState::Sma(SmaState::new(*period)),
                    IndicatorNameV1::Ema => IndicatorState::Ema(EmaState::new(*period)),
                    IndicatorNameV1::Rsi => IndicatorState::Rsi(RsiState::new(*period)),
                };
                let input = input
                    .as_deref()
                    .ok_or_else(|| "SMA/EMA/RSI require an input expression.".to_string())?;
                Self::Indicator(state, Box::new(Self::compile(input, max_lookback)?))
            }
            ExprV1::Pattern { id } => {
                return Err(format!(
                    "Pattern rule {id} must be evaluated by its dedicated detector, not the numeric evaluator."
                ));
            }
        })
    }

    fn advance(&mut self, bar: &EvalBar, history: &VecDeque<EvalBar>) -> Option<f64> {
        match self {
            Self::Number(value) => Some(*value),
            Self::Field(field, lookback) => {
                let index = (history.len() - 1).checked_sub(*lookback)?;
                Some(read_field(&history[index], *field))
            }
            Self::Binary(op, left, right) => {
                // Both child states advance even when one already determines the result.
                let left = left.advance(bar, history);
                let right = right.advance(bar, history);
                binary_point(*op, left, right)
            }
            Self::Indicator(state, input) => state.advance(input.advance(bar, history)),
            Self::Atr(state) => state.advance(bar.high, bar.low, bar.close),
            Self::VolumeSma(state) => state.advance(Some(bar.volume)),
            Self::Cross {
                kind,
                left,
                right,
                previous,
            } => {
                let current = (left.advance(bar, history), right.advance(bar, history));
                let prior = std::mem::replace(previous, current);
                cross_point(*kind, prior, current).map(|flag| flag as u8 as f64)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::native_scanner::ast::{
        evaluate_expression, minimum_bars_for_expression, MAX_LOOKBACK,
    };

    #[test]
    fn forward_state_matches_the_series_evaluator_across_seams() {
        let field = |field, lookback| Box::new(ExprV1::Field { field, lookback });
        let indicator = |name, period, input| ExprV1::Indicator {
            name,
            period,
            input,
        };
        let divided = ExprV1::Binary {
            op: BinaryOpV1::Div,
            left: field(OhlcvFieldV1::Close, 2),
            right: field(OhlcvFieldV1::Volume, 0),
        };
        let ema = indicator(IndicatorNameV1::Ema, 5, Some(Box::new(divided)));
        let rsi = indicator(IndicatorNameV1::Rsi, 7, Some(Box::new(ema)));
        let atr = indicator(IndicatorNameV1::Atr, 11, None);
        let volume_sma = indicator(IndicatorNameV1::VolumeSma, 3, None);
        let combined = ExprV1::Binary {
            op: BinaryOpV1::Or,
            left: Box::new(ExprV1::Cross {
                kind: CrossKindV1::Over,
                left: Box::new(rsi),
                right: Box::new(ExprV1::Number { value: 50.0 }),
            }),
            right: Box::new(ExprV1::Cross {
                kind: CrossKindV1::Under,
                left: Box::new(atr),
                right: Box::new(volume_sma),
            }),
        };
        let long_warmup = (0..8).fold(*field(OhlcvFieldV1::Close, MAX_LOOKBACK), |input, _| {
            indicator(IndicatorNameV1::Sma, 400, Some(Box::new(input)))
        });
        let warmup = minimum_bars_for_expression(&long_warmup);
        assert!(warmup > 5_000);

        let bars: Vec<_> = (0..warmup + 8)
            .map(|index| {
                let close = 100.0 + (index % 29) as f64;
                EvalBar {
                    date: 0,
                    open: close,
                    high: close + 2.0,
                    low: close - 1.0,
                    close,
                    volume: if index % 59 < 3 {
                        0.0
                    } else {
                        (index % 11 + 1) as f64
                    },
                }
            })
            .collect();

        for expression in [combined, long_warmup] {
            let expected = evaluate_expression(&expression, &bars).unwrap().numeric();
            assert!(expected.iter().any(Option::is_some));
            for page_size in [1, 59, 1_000, 5_000] {
                let mut forward = ForwardRuleEvaluator::new(&expression).unwrap();
                for (page_index, page) in bars.chunks(page_size).enumerate() {
                    for (offset, &bar) in page.iter().enumerate() {
                        let index = page_index * page_size + offset;
                        assert_eq!(
                            forward.advance(bar).value,
                            expected[index],
                            "bar {index}, page size {page_size}"
                        );
                        assert!(forward.history.len() <= forward.max_lookback + 1);
                    }
                }
            }
        }
    }
}
