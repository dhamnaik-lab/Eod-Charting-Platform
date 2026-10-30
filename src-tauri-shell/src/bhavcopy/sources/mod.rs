use chrono::{Datelike, NaiveDate};

pub mod bse;
pub mod nse;

pub use bse::*;
pub use nse::*;

pub const EXCHANGE_UDIFF_START: &str = "2024-07-08";

pub fn apply_template(template: &str, date: NaiveDate) -> String {
    let short_month = short_month_name(date.month());
    let date_key = date.format("%Y%m%d").to_string();
    let ddmmyyyy = date.format("%d%m%Y").to_string();
    let ddmmyy = date.format("%d%m%y").to_string();
    let yyyymmdd = date.format("%Y-%m-%d").to_string();
    let year = date.year().to_string();
    let month = format!("{:02}", date.month());
    let day = format!("{:02}", date.day());

    template
        .replace("{ddmmyyyy}", &ddmmyyyy)
        .replace("{ddmmyy}", &ddmmyy)
        .replace("{date_key}", &date_key)
        .replace("{yyyymmdd}", &yyyymmdd)
        .replace("{year}", &year)
        .replace("{month}", &month)
        .replace("{day}", &day)
        .replace("{MMM}", short_month)
}

pub fn short_month_name(month: u32) -> &'static str {
    match month {
        1 => "JAN",
        2 => "FEB",
        3 => "MAR",
        4 => "APR",
        5 => "MAY",
        6 => "JUN",
        7 => "JUL",
        8 => "AUG",
        9 => "SEP",
        10 => "OCT",
        11 => "NOV",
        _ => "DEC",
    }
}
