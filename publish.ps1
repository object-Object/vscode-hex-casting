Param(
    [parameter(Mandatory=$true, ValueFromRemainingArguments = $true)]
    [string[]]$vsceArgs
    )

vsce publish @vsceArgs
git push
git push --tags
