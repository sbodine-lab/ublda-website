# Mailing-list removal requests

Public link: https://ublda.org/unsubscribe

The main site and consulting footers open a Google Form with one required field: UMich uniqname. Submissions are saved in the private [requests Sheet](https://docs.google.com/spreadsheets/d/1pHmVXLBQai5NFtkh4Rv-naVCo5rRIysd_16pd4g1-9U/edit). An installed Apps Script submission trigger emails sbodine@umich.edu with the uniqname and a link to its row.

## Manual removal

1. Open the Sheet from the notification email.
2. Find the uniqname in the [UBLDA MCommunity group](https://mcommunity.umich.edu/group/Undergraduate%20Business%20Leaders%20for%20Diverse%20Abilities) and remove it.
3. Verify the member is gone, then check **Removed** in the Sheet. Retain the record so a later import does not add the person back without a new opt-in.

A blank Removed checkbox means removal is still pending. Email sent records when the notification was sent, not when the member was removed. The row marked TEST is setup verification and requires no action.

The script sends notifications only to Sam. It does not remove MCommunity members, send member confirmations, or send announcements. Google Forms saves responses even if an email notification fails; check the Sheet before each mailing and review Apps Script failure notices.

## Maintenance

- [Edit form](https://docs.google.com/forms/d/1f8ythd7hqG6DbJMUR-AEe8W-uHUFRM_mMsRgpT9MLAQ/edit)
- [Apps Script project](https://script.google.com/home/projects/1V1i-pcqYxNXo2zsEZ6iA3VzKXiGBR_OUFiMyt0o9VwlodVxrCVavFzkA/edit)
- Trigger: notifyRemoval, from spreadsheet, on form submit, owned by sbodine@umich.edu.
- Form responder access: anyone with the link. Form editor and Sheet access remain restricted.
- The script runs independently of the website deployment. Editing or deploying the website does not update it.

## Future email footer

To leave the mailing list: https://ublda.org/unsubscribe

Add this to the next regular email. The form submits a request for manual removal; it is not an automatic one-click unsubscribe endpoint. It cannot change emails already delivered.
