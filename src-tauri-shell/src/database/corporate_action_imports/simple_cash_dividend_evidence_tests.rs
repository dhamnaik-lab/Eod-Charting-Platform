//! Pure fixtures only. No database, network, filesystem or application runtime.
use super::parse_corporate_action_purpose;
use super::simple_cash_dividend_evidence::{
    classify_simple_cash_dividend_evidence as classify,
    revalidate_simple_cash_dividend_evidence as revalidate,
    SimpleCashDividendEvidence::{EligibleSimpleCash, Ineligible},
    SimpleCashDividendReason::*,
};

#[test]
fn accepts_retained_interim_dividend_fixture() {
    assert_eq!(
        classify("Interim Dividend - Rs. 7.50 per share"),
        EligibleSimpleCash(7.5)
    );
}

#[test]
fn accepts_retained_interim_div_abbreviation_fixture() {
    assert_eq!(
        classify("Interim Div - Rs. 7.50 per share"),
        EligibleSimpleCash(7.5)
    );
}

#[test]
fn accepts_only_plain_interim_final_or_unqualified_single_label() {
    for label in [
        "Dividend",
        "Div",
        "Interim Dividend",
        "Interim Div",
        "Final Dividend",
        "Final Div",
    ] {
        assert_eq!(
            classify(&format!("{label} - Rs. 2.50 per share")),
            EligibleSimpleCash(2.5)
        );
    }
}

#[test]
fn accepts_existing_currency_marker_variants_with_parser_parity() {
    for marker in ["Rs.", "Rs", "Re.", "Re", "INR", "₹"] {
        let purpose = format!("Dividend - {marker} 1.25 per share");
        assert_eq!(classify(&purpose), EligibleSimpleCash(1.25), "{purpose}");
        assert_eq!(
            parse_corporate_action_purpose(&purpose).cash_amount,
            Some(1.25)
        );
    }
}

#[test]
fn accepts_ascii_case_and_whitespace_variation() {
    assert_eq!(
        classify("\t  interim  DIV - rs.\t7.50\nper share \r\n"),
        EligibleSimpleCash(7.5)
    );
}

#[test]
fn accepts_integer_decimal_and_currency_spacing_without_rounding() {
    for purpose in [
        "Dividend Rs.7.500 per share",
        "Dividend: INR 007.500 per share.",
        "Dividend-Re.7.5 per share",
    ] {
        assert_eq!(classify(purpose), EligibleSimpleCash(7.5), "{purpose}");
    }
    assert_eq!(classify("Dividend Rs 7 per share"), EligibleSimpleCash(7.0));
    assert_eq!(
        classify("Dividend ₹0.0001 per share"),
        EligibleSimpleCash(0.0001)
    );
}

#[test]
fn accepts_single_rupee_slash_dash_terminator() {
    assert_eq!(
        classify("Final Dividend - Rs 6/- Per Share"),
        EligibleSimpleCash(6.0)
    );
}

#[test]
fn r3_accepts_exact_agm_context_with_canonical_parser_and_stored_amount() {
    // Captured October-20 wording examples, without changing the official parser.
    let fixtures = [
        ("Annual General Meeting And Dividend Re.1/- Per Share", 1.0),
        ("Annual General Meeting And Dividend Rs.2/- Per Share", 2.0),
        (
            "Annual General Meeting And Dividend Rs.1.50 Per Share",
            1.50,
        ),
        ("Annual General Meeting / Dividend - Re 1/- Per Share", 1.0),
        ("Annual General Meeting/Dividend Rs 10 Per Share", 10.0),
        (
            "Annual General Meeting / Final Dividend - Rs 4.50/- Per Share",
            4.5,
        ),
        ("Interim Dividend - Rs 2/- Per Share (Purpose Revised)", 2.0),
        ("Dividend-Rs.3 Pr Share", 3.0),
        ("Dividend-Rs.2/- Per Sh", 2.0),
    ];
    for (purpose, expected) in fixtures {
        let parsed = parse_corporate_action_purpose(purpose);
        assert_eq!(parsed.action_type, "DIVIDEND", "{purpose}");
        assert_eq!(parsed.parse_status, "PARSED", "{purpose}");
        assert_eq!(parsed.cash_amount, Some(expected), "{purpose}");
        assert!(
            parsed.factor.is_none() && parsed.price_factor.is_none(),
            "{purpose}"
        );
        assert_eq!(classify(purpose), EligibleSimpleCash(expected), "{purpose}");
        assert_eq!(
            revalidate(purpose, Some(expected)),
            EligibleSimpleCash(expected),
            "{purpose}"
        );
    }
}

#[test]
fn r3_keeps_preference_share_and_unrecognized_meeting_context_outside_r1() {
    for (purpose, amount) in [
        (
            "Annual General Meeting/Dividend Rs 7.50 per preference share",
            7.5,
        ),
        ("EGM And Dividend Rs 1.50 Per Share", 1.5),
    ] {
        // The broad import parser can read these amounts; that is not R1 eligibility.
        assert_eq!(
            parse_corporate_action_purpose(purpose).cash_amount,
            Some(amount)
        );
        assert_eq!(classify(purpose), Ineligible(NotSimpleExplicitPerShareCash));
        assert_eq!(
            revalidate(purpose, Some(amount)),
            Ineligible(NotSimpleExplicitPerShareCash)
        );
    }
}

#[test]
fn r3_agm_cash_requires_exact_unambiguous_stored_amount() {
    let purpose = "Annual General Meeting And Dividend Rs.1.50 Per Share";
    assert_eq!(
        revalidate(purpose, None),
        Ineligible(MissingStoredCashAmount)
    );
    assert_eq!(
        revalidate(purpose, Some(0.0)),
        Ineligible(InvalidStoredCashAmount)
    );
    assert_eq!(
        revalidate(purpose, Some(1.51)),
        Ineligible(StoredCashAmountMismatch)
    );
    let adjacent = f64::from_bits(1.5_f64.to_bits() + 1);
    assert_eq!(
        revalidate(purpose, Some(adjacent)),
        Ineligible(StoredCashAmountMismatch)
    );
}

#[test]
fn r3_agm_keeps_percentage_revision_and_qualified_wording_blocked() {
    for purpose in [
        "Agm/Dividend-10%",
        "Annual General Meeting And Dividend - 10%",
        "Annual General Meeting/Dividend Rs 7.50 per preference share",
        "Annual General Meeting And Dividend Rs.1.50 Per Share Subject To Approval",
        "Annual General Meeting And Proposed Dividend Rs.1.50 Per Share",
        "Annual General Meeting And Dividend Rs.1.50 Per Share (Revised)",
        "Purpose Revised: Annual General Meeting And Dividend Rs.1.50 Per Share",
        "Annual General Meeting And Dividend Rs.1.50 Per Share For FY 2025-26",
        "Annual General Meeting And Dividend Rs 1.50 (15%) Per Share",
        "Annual General Meeting And Dividend Rs -1.50 Per Share",
        "Annual General Meeting And Dividend Rs 1.50 Per Share Or Rs 2 Per Share",
        "EGM And Dividend Rs 1.50 Per Share",
    ] {
        assert_eq!(
            classify(purpose),
            Ineligible(NotSimpleExplicitPerShareCash),
            "{purpose}"
        );
    }
}

#[test]
fn r3_agm_preserves_existing_special_multiple_compound_and_unit_exclusions() {
    assert_eq!(
        classify("Annual General Meeting/Dividend Rs 2 Per Share/Special Dividend Rs 3 Per Share"),
        Ineligible(InclusiveOrSpecialDividend)
    );
    assert_eq!(
        classify("Annual General Meeting/Dividend Rs 2 Per Share/Final Dividend Rs 3 Per Share"),
        Ineligible(MultipleDividendComponents)
    );
    assert_eq!(
        classify("Annual General Meeting/Dividend Rs 2 Per Share/Bonus 1:1"),
        Ineligible(CompoundAction)
    );
    assert_eq!(
        classify("Annual General Meeting/Dividend Rs 2 Per Unit"),
        Ineligible(UnitOrMixedDistribution)
    );
}

#[test]
fn rejects_empty_or_nonsemantic_purpose() {
    for purpose in ["", " \n\t", "---", "₹"] {
        assert_eq!(classify(purpose), Ineligible(EmptyPurpose));
    }
}

#[test]
fn does_not_confuse_nondividend_or_subdivision_with_div_abbreviation() {
    for purpose in [
        "Bonus 1:1",
        "Rights 1:9 at Rs 95 per share",
        "Face Value Split (Sub-Division) - From Rs 10 To Rs 2",
        "Bright Industries",
        "Demerger",
    ] {
        assert_eq!(classify(purpose), Ineligible(NotDividend), "{purpose}");
    }
}

#[test]
fn rejects_compound_split_bonus_rights_or_demerger() {
    for purpose in [
        "Dividend Rs 1.35 per share and Split from Rs 10 to Rs 2",
        "Div 30%/Bonus - 1:1",
        "Dividend Rs 2 per share and Rights 1:9",
        "Dividend Rs 2 per share; Demerger",
        "Dividend Rs 2 per share and De-merger",
        "Dividend Rs 2 per share and Spin-off",
    ] {
        assert_eq!(classify(purpose), Ineligible(CompoundAction), "{purpose}");
    }
}

#[test]
fn rejects_multiple_ordinary_dividend_components() {
    for separator in [" & ", " And ", " / ", " Plus ", " ", ";", "+"] {
        let purpose =
            format!("Interim Dividend Rs 2 per share{separator}Final Dividend Rs 3 per share");
        assert_eq!(
            classify(&purpose),
            Ineligible(MultipleDividendComponents),
            "{purpose}"
        );
    }
}

#[test]
fn rejects_retained_special_multicomponent_fixture_without_summing() {
    let purpose = "Interim Dividend - Rs. 7.50 per share & Special Dividend - Rs. 3.50 per share";
    assert_eq!(classify(purpose), Ineligible(InclusiveOrSpecialDividend));
    assert_eq!(
        parse_corporate_action_purpose(purpose).cash_amount,
        Some(11.0)
    );
}

#[test]
fn rejects_every_retained_inventory_multi_dividend_variant() {
    for purpose in [
        "Annual General Meeting/Dividend - Rs 24 Per Share/Special Dividend - Rs 24 Per Share",
        "Interim Dividend - Rs 41 Per Share And Special Dividend - Rs 70 Per Share",
        "Final Dividend Rs 6/- Plus Special Dividend Rs 4/- Per Share",
        "Interim Dividend - Rs 65 Per Share Special Dividend - Rs 5 Per Share",
        "Dividend - Rs 35 Per Share & Special Dividend Of Rs 100 Per Share/ Special Dividend Of Rs 30",
    ] {
        assert_eq!(classify(purpose), Ineligible(InclusiveOrSpecialDividend), "{purpose}");
    }
}

#[test]
fn rejects_inclusive_totals_even_with_only_one_dividend_marker() {
    for purpose in [
        "Final Dividend Rs.8.50 Per Share (Including Special Dividend Rs.2 Per Share)",
        "Dividend Rs 7 per share inclusive of other components",
        "Dividend Rs 7 per share includes other components",
    ] {
        assert_eq!(
            classify(purpose),
            Ineligible(InclusiveOrSpecialDividend),
            "{purpose}"
        );
    }
}

#[test]
fn leaves_standalone_special_dividend_manual_only_in_r1() {
    assert_eq!(
        classify("Special Dividend Rs 2 per share"),
        Ineligible(InclusiveOrSpecialDividend)
    );
}

#[test]
fn rejects_incomplete_announced_components() {
    assert_eq!(
        classify("Interim Dividend Rs 7.50 per share and Special Dividend amount to be announced"),
        Ineligible(InclusiveOrSpecialDividend)
    );
    assert_eq!(
        classify("Dividend amount to be announced per share"),
        Ineligible(NotSimpleExplicitPerShareCash)
    );
}

#[test]
fn rejects_retained_headline_unit_distribution() {
    for purpose in [
        "Distribution Rs 5.10 Per Unit Comprising Of Dividend - Re 0.09 Per Unit/Interest Amount - Rs 2.42 Per Unit/Repayment Of Spv Debt - Rs 2.57 Per Unit/Interest On Fixed Deposits - Re 0.02 Per Unit",
        "Distritbution - Rs 2.98 Per Unit Comprising Of Rs 1.84 Per Unit In The Form Dividend & Re 0.85 Per Unit In The Form Of Interest",
    ] {
        assert_eq!(classify(purpose), Ineligible(UnitOrMixedDistribution), "{purpose}");
    }
}

#[test]
fn rejects_retained_complete_and_incomplete_mixed_distributions() {
    for purpose in [
        "Interest Payment Rs 2.03 Per Unit/Return Of Capital Rs 1.57 Per Unit/Dividend Re 0.55 Per Unit/Other Income On Surplus Re 0.04 Per Unit",
        "Dividend - Rs 2.54 Per Unit/Interest Amount - Rs 1.14 Per Unit/Proceeds - 1.98 Per Unit",
        "Dividend Rs 2 per share and Interest Rs 1 per share",
    ] {
        assert_eq!(classify(purpose), Ineligible(UnitOrMixedDistribution), "{purpose}");
    }
}

#[test]
fn rejects_single_per_unit_dividend() {
    assert_eq!(
        classify("Dividend Rs 7 per unit"),
        Ineligible(UnitOrMixedDistribution)
    );
}

#[test]
fn requires_both_explicit_currency_and_per_share_basis() {
    for purpose in [
        "Dividend Rs 7.50",
        "Dividend 7.50 per share",
        "Dividend Rs 7.50 per security",
        "Dividend USD 7.50 per share",
        "Dividend $7.50 per share",
    ] {
        assert_eq!(
            classify(purpose),
            Ineligible(NotSimpleExplicitPerShareCash),
            "{purpose}"
        );
    }
}

#[test]
fn rejects_signed_cash_even_when_manual_currency_helper_skips_minus() {
    for purpose in [
        "Dividend Rs -7.50 per share",
        "Dividend Rs +7.50 per share",
        "Dividend Rs (-7.50) per share",
        "Dividend Rs −7.50 per share",
    ] {
        assert_eq!(
            classify(purpose),
            Ineligible(NotSimpleExplicitPerShareCash),
            "{purpose}"
        );
    }
}

#[test]
fn rejects_zero_and_nonfinite_derived_cash() {
    assert_eq!(
        classify("Dividend Rs 0.00 per share"),
        Ineligible(ExistingParserDidNotConfirm)
    );
    assert_eq!(
        classify(&format!("Dividend Rs {} per share", "9".repeat(400))),
        Ineligible(ExistingParserDidNotConfirm)
    );
}

#[test]
fn rejects_partial_or_unsupported_numeric_notation() {
    for amount in [
        "7..50", ".50", "7.", "1,000", "7e2", "NaN", "Infinity", "7.50USD", "7 50", "7/2", "7%",
    ] {
        assert_eq!(
            classify(&format!("Dividend Rs {amount} per share")),
            Ineligible(NotSimpleExplicitPerShareCash),
            "{amount}"
        );
    }
}

#[test]
fn rejects_extra_amounts_percentages_face_value_and_dates() {
    for purpose in [
        "Dividend Rs 7.50 and Rs 2 per share",
        "Dividend Rs 7.50 (75%) per share",
        "Dividend 75% on face value Rs 10 per share",
        "Dividend Rs 7.50 on face value Rs 10 per share",
        "Dividend Rs 7.50 for FY 2025-26 per share",
    ] {
        assert_eq!(
            classify(purpose),
            Ineligible(NotSimpleExplicitPerShareCash),
            "{purpose}"
        );
    }
}

#[test]
fn rejects_negated_conditional_cancelled_or_unrecognized_wording() {
    for purpose in [
        "No Dividend Rs 7.50 per share",
        "Dividend not recommended Rs 7.50 per share",
        "Dividend Rs 7.50 per share cancelled",
        "Proposed Dividend Rs 7.50 per share",
        "Dividend Rs 7.50 subject to approval per share",
        "Dividend Rs 7.50 per share or Rs 8 per share",
        "Annual General Meeting/Dividend Rs 7.50 per preference share",
    ] {
        assert_eq!(
            classify(purpose),
            Ineligible(NotSimpleExplicitPerShareCash),
            "{purpose}"
        );
    }
}

#[test]
fn rejects_unicode_numeric_and_punctuation_normalization_traps() {
    for purpose in [
        "Dividend Rs ７.５０ per share",
        "Dividend Rs 7,50 per share",
        "Dividend — Rs 7.50 per share",
        "Dividend Rs 7.50 per share..",
    ] {
        assert_eq!(
            classify(purpose),
            Ineligible(NotSimpleExplicitPerShareCash),
            "{purpose}"
        );
    }
}

#[test]
fn revalidates_exact_stored_cash_using_existing_f64_normalization() {
    assert_eq!(
        revalidate("Dividend Rs 007.500 per share", Some(7.5)),
        EligibleSimpleCash(7.5)
    );
    assert_eq!(
        revalidate("Interim Div - Rs. 7.50 per share", Some(7.5)),
        EligibleSimpleCash(7.5)
    );
}

#[test]
fn rejects_missing_stored_cash() {
    assert_eq!(
        revalidate("Dividend Rs 7.50 per share", None),
        Ineligible(MissingStoredCashAmount)
    );
}

#[test]
fn rejects_nonpositive_or_nonfinite_stored_cash() {
    for amount in [0.0, -0.0, -1.0, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        assert_eq!(
            revalidate("Dividend Rs 7.50 per share", Some(amount)),
            Ineligible(InvalidStoredCashAmount)
        );
    }
}

#[test]
fn rejects_mismatched_stored_cash() {
    assert_eq!(
        revalidate("Dividend Rs 7.50 per share", Some(7.51)),
        Ineligible(StoredCashAmountMismatch)
    );
}

#[test]
fn exact_match_does_not_hide_one_ulp_mismatch_with_epsilon() {
    let adjacent = f64::from_bits(7.5_f64.to_bits() + 1);
    assert_eq!(
        revalidate("Dividend Rs 7.50 per share", Some(adjacent)),
        Ineligible(StoredCashAmountMismatch)
    );
}

#[test]
fn revalidation_preserves_raw_purpose_exclusion_before_checking_stored_value() {
    assert_eq!(
        revalidate("Dividend Rs 7 per unit", Some(7.0)),
        Ineligible(UnitOrMixedDistribution)
    );
    assert_eq!(
        revalidate("Dividend Rs 7 per unit", None),
        Ineligible(UnitOrMixedDistribution)
    );
}

#[test]
fn keeps_existing_parser_output_unchanged_before_and_after_classification() {
    for purpose in [
        "Interim Dividend - Rs. 7.50 per share",
        "Interim Dividend - Rs. 7.50 per share & Special Dividend - Rs. 3.50 per share",
        "Dividend Rs 1.35 per share and Split from Rs 10 to Rs 2",
    ] {
        let before = format!("{:?}", parse_corporate_action_purpose(purpose));
        let _ = classify(purpose);
        assert_eq!(
            before,
            format!("{:?}", parse_corporate_action_purpose(purpose))
        );
    }
}

#[test]
fn r2_diagnostic_labels_distinguish_categories_without_granting_eligibility() {
    let cases = [
        (
            "Annual General Meeting/Dividend Rs 7.50 per preference share",
            NotSimpleExplicitPerShareCash,
        ),
        ("Dividend Rs 7.50 per share and Bonus 1:1", CompoundAction),
        (
            "Special Dividend Rs 7.50 per share",
            InclusiveOrSpecialDividend,
        ),
        (
            "Interim Dividend Rs 2 per share Final Dividend Rs 3 per share",
            MultipleDividendComponents,
        ),
        ("Dividend Rs 7 per unit", UnitOrMixedDistribution),
    ];
    for (purpose, expected) in cases {
        assert_eq!(classify(purpose), Ineligible(expected), "{purpose}");
        assert!(!expected.diagnostic_label().is_empty());
    }
    assert_ne!(
        NotSimpleExplicitPerShareCash.diagnostic_label(),
        InclusiveOrSpecialDividend.diagnostic_label()
    );
    assert_ne!(
        StoredCashAmountMismatch.diagnostic_label(),
        MissingStoredCashAmount.diagnostic_label()
    );
}
