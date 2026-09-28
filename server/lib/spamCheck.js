// Simple honeypot check for the public forms.
//
// Both forms include a hidden field that real users never see (it's
// visually hidden and skipped in the tab order) but that most bots fill in
// anyway because they fill in every field they find. If it arrives
// non-empty, we treat the submission as spam.
//
// This has zero setup cost and no external dependency, unlike a CAPTCHA
// service. It won't stop a targeted human spammer, but it blocks the bulk
// of automated form-spam bots with no friction for real registrants.
const HONEYPOT_FIELD = "hp_confirm";

function isSpam(reqBody) {
  const value = reqBody && reqBody[HONEYPOT_FIELD];
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = { isSpam, HONEYPOT_FIELD };
