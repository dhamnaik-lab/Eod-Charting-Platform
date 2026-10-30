//! Index names are source identifiers, not separate economic histories.
//! Explicit equivalences only; never infer identity from a prefix or price.
//! 2015 names: https://niftyindices.com/docs/default-source/press-release-upload/ind_prs22092015.pdf
//! SPCNXNIFTY retains the equivalence already accepted by the CSV importer.

pub(crate) struct IndexAliasFamily {
    pub canonical: &'static str,
    pub symbols: &'static [&'static str],
}

// Preserve the importer's established canonical storage keys (NIFTY,
// BANKNIFTY and SMALLCAP100). Names here use normalize_index_key's spelling.
const NSE_INDEX_FAMILIES: &[IndexAliasFamily] = &[
    IndexAliasFamily {
        canonical: "NIFTY",
        symbols: &["NIFTY", "NIFTY50", "CNXNIFTY", "SPCNXNIFTY"],
    },
    IndexAliasFamily {
        canonical: "BANKNIFTY",
        symbols: &["BANKNIFTY", "NIFTYBANK", "CNXBANK"],
    },
    IndexAliasFamily {
        canonical: "NIFTYNEXT50",
        symbols: &["NIFTYNEXT50", "CNXNIFTYJUNIOR"],
    },
    IndexAliasFamily {
        canonical: "NIFTY100",
        symbols: &["NIFTY100", "CNX100"],
    },
    IndexAliasFamily {
        canonical: "NIFTY200",
        symbols: &["NIFTY200", "CNX200"],
    },
    IndexAliasFamily {
        canonical: "NIFTY500",
        symbols: &["NIFTY500", "CNX500"],
    },
    IndexAliasFamily {
        canonical: "NIFTY100LIQUID15",
        symbols: &["NIFTY100LIQUID15", "LIX15"],
    },
    IndexAliasFamily {
        canonical: "NIFTYMIDCAPLIQUID15",
        symbols: &["NIFTYMIDCAPLIQUID15", "LIX15MIDCAP"],
    },
    IndexAliasFamily {
        canonical: "NIFTYMIDCAP100",
        symbols: &["NIFTYMIDCAP100", "CNXMIDCAP"],
    },
    IndexAliasFamily {
        canonical: "SMALLCAP100",
        symbols: &["SMALLCAP100", "NIFTYSMALLCAP100", "CNXSMALLCAP"],
    },
    IndexAliasFamily {
        canonical: "NIFTYAUTO",
        symbols: &["NIFTYAUTO", "CNXAUTO"],
    },
    IndexAliasFamily {
        canonical: "FINNIFTY",
        symbols: &[
            "FINNIFTY",
            "NIFTYFINSERVICE",
            "NIFTYFINANCIALSERVICE",
            "NIFTYFINANCIALSERVICES",
            "CNXFINANCE",
        ],
    },
    IndexAliasFamily {
        canonical: "NIFTYFMCG",
        symbols: &["NIFTYFMCG", "CNXFMCG"],
    },
    IndexAliasFamily {
        canonical: "NIFTYIT",
        symbols: &["NIFTYIT", "CNXIT"],
    },
    IndexAliasFamily {
        canonical: "NIFTYMEDIA",
        symbols: &["NIFTYMEDIA", "CNXMEDIA"],
    },
    IndexAliasFamily {
        canonical: "NIFTYMETAL",
        symbols: &["NIFTYMETAL", "CNXMETAL"],
    },
    IndexAliasFamily {
        canonical: "NIFTYPHARMA",
        symbols: &["NIFTYPHARMA", "CNXPHARMA"],
    },
    IndexAliasFamily {
        canonical: "NIFTYPSUBANK",
        symbols: &["NIFTYPSUBANK", "CNXPSUBANK"],
    },
    IndexAliasFamily {
        canonical: "NIFTYREALTY",
        symbols: &["NIFTYREALTY", "CNXREALTY"],
    },
    IndexAliasFamily {
        canonical: "NIFTYENERGY",
        symbols: &["NIFTYENERGY", "CNXENERGY"],
    },
    IndexAliasFamily {
        canonical: "NIFTYINFRASTRUCTURE",
        symbols: &["NIFTYINFRASTRUCTURE", "CNXINFRASTRUCTURE"],
    },
    IndexAliasFamily {
        canonical: "NIFTYSERVICESECTOR",
        symbols: &["NIFTYSERVICESECTOR", "CNXSERVICESECTOR"],
    },
    IndexAliasFamily {
        canonical: "NIFTYCOMMODITIES",
        symbols: &["NIFTYCOMMODITIES", "CNXCOMMODITIES"],
    },
    IndexAliasFamily {
        canonical: "NIFTYCONSUMPTION",
        symbols: &["NIFTYCONSUMPTION", "CNXCONSUMPTION"],
    },
    IndexAliasFamily {
        canonical: "NIFTYMNC",
        symbols: &["NIFTYMNC", "CNXMNC"],
    },
    IndexAliasFamily {
        canonical: "NIFTYPSE",
        symbols: &["NIFTYPSE", "CNXPSE"],
    },
    IndexAliasFamily {
        canonical: "NIFTY50SHARIAH",
        symbols: &["NIFTY50SHARIAH", "CNXNIFTYSHARIAH"],
    },
    IndexAliasFamily {
        canonical: "NIFTY500SHARIAH",
        symbols: &["NIFTY500SHARIAH", "CNX500SHARIAH"],
    },
    IndexAliasFamily {
        canonical: "NIFTYSHARIAH25",
        symbols: &["NIFTYSHARIAH25", "CNXSHARIAH25"],
    },
    IndexAliasFamily {
        canonical: "NIFTYDIVIDENDOPPORTUNITIES50",
        symbols: &["NIFTYDIVIDENDOPPORTUNITIES50", "CNXDIVIDENDOPPORTUNITIES"],
    },
    IndexAliasFamily {
        canonical: "NIFTYLOWVOLATILITY50",
        symbols: &["NIFTYLOWVOLATILITY50", "CNXLOWVOLATILITY"],
    },
    IndexAliasFamily {
        canonical: "NIFTYALPHA50",
        symbols: &["NIFTYALPHA50", "CNXALPHA"],
    },
    IndexAliasFamily {
        canonical: "NIFTYHIGHBETA50",
        symbols: &["NIFTYHIGHBETA50", "CNXHIGHBETA"],
    },
    IndexAliasFamily {
        canonical: "NIFTY50VALUE20",
        symbols: &["NIFTY50VALUE20", "NV20"],
    },
    IndexAliasFamily {
        canonical: "NIFTYGROWTHSECTORS15",
        symbols: &["NIFTYGROWTHSECTORS15", "NI15"],
    },
    IndexAliasFamily {
        canonical: "NIFTY100EQUALWEIGHT",
        symbols: &["NIFTY100EQUALWEIGHT", "CNX100EQUALWEIGHT"],
    },
    IndexAliasFamily {
        canonical: "NIFTY50USD",
        symbols: &["NIFTY50USD", "CNXDEFTY"],
    },
    IndexAliasFamily {
        canonical: "NIFTY50DIVIDENDPOINTS",
        symbols: &["NIFTY50DIVIDENDPOINTS", "CNXNIFTYDIVIDEND"],
    },
    IndexAliasFamily {
        canonical: "NIFTYQUALITY30",
        symbols: &["NIFTYQUALITY30", "NSEQUALITY30"],
    },
];

pub(crate) fn nse_index_alias_family(symbol: &str) -> Option<&'static IndexAliasFamily> {
    NSE_INDEX_FAMILIES
        .iter()
        .find(|family| family.symbols.contains(&symbol))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn index_alias_registry_has_unique_explicit_names() {
        let mut seen = HashSet::new();
        for family in NSE_INDEX_FAMILIES {
            assert!(family.symbols.contains(&family.canonical));
            for symbol in family.symbols {
                assert!(seen.insert(symbol), "ambiguous alias: {symbol}");
                assert_eq!(
                    nse_index_alias_family(symbol).unwrap().canonical,
                    family.canonical
                );
            }
        }
        for unrelated in [
            "NIFTY50TR",
            "NIFTY50PR1XINVERSE",
            "CNXUNKNOWN",
            "NIFTYBEES",
            "SENSEX",
        ] {
            assert!(nse_index_alias_family(unrelated).is_none());
        }
    }
}
