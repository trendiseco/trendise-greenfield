# Checkout PIN directory

Checkout suggests a postal district and state or union territory after a six-digit Indian PIN is entered. District and state stay editable. City is a separate required field for the customer’s city or town. Unlisted PINs and lookup failures allow manual entry. A lookup is not a courier serviceability check.

Source: Department of Posts, Ministry of Communications, [All India Pincode Directory](https://data.gov.in/catalog/all-india-pincode-directory-through-webservice), Government Open Data License – India. This build uses a [2024 republication of the public CSV](https://github.com/dropdevrahul/pincodes-india/blob/main/pincode.csv), SHA-256 `84af12fa29adddedfa9addcf46546000d89d2e2899b2993dc88050fafc8861e2`. It covers 19,299 PIN codes across all 36 states and union territories; more recent codes may be missing.

The bundled data excludes the source’s test office entry and keeps PIN, postal district, state and available postal coordinates. It prefers areas supported by delivery office records when a PIN covers multiple areas. Lookup loads one small file from the TRENDISE website; no customer address is sent to an external map or postal service.

To refresh, obtain an updated directory CSV and run `python3 scripts/build-pin-directory.py /path/to/directory.csv`. Verify coverage and update the source attribution and snapshot checksum above.

Partial payment eligibility uses straight-line distance from the bundled reference point for PIN 501505. Postal coordinates are representative points, not precise street locations or driving distances. PINs without usable coordinates cannot show partial payment. Both checkout and the order API use the same bundled data and threshold.
