// EAS Metadata (eas metadata:push) — the App Store listing in store.config.json, plus the App Review
// contact from store.review.json. That file is git-ignored: the repository is public, so the email
// and phone stay on your computer. Copy store.review.example.json to store.review.json and fill it in.
const fs = require('fs');
const path = require('path');

const base = require('./store.config.json');
const file = path.join(__dirname, 'store.review.json');
if (!fs.existsSync(file)) {
  throw new Error('Missing mobile/store.review.json — copy store.review.example.json and add your email and phone.');
}
const contact = JSON.parse(fs.readFileSync(file, 'utf8'));

module.exports = {
  ...base,
  apple: {
    ...base.apple,
    review: { ...base.apple.review, ...contact },
  },
};
