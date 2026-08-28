# Failure / exclusion case: every entry must be refused, nothing fetched.
# Source URLs: none - these are local, private-range, and credentialed targets used to prove the exclusion rules.
# Retrieved: 2026-08-28
# Expected: each entry listed under "Refused" with a reason; no audit and no network request is made.
localhost
192.168.1.1
https://user@evil.test
