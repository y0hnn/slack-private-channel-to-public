# Slack Convert Private Channels To Public

🔒On Slack, private channels can be really bad. Often in companies, private channels should be public.
Slack allow to convert a public channel to a private channel, but not the opposite. Such a shame.
However, it can be done easily with their Import API.

This NodeJS module will extract the content of a private channel *you have access to*, and will generate an archive ready to be imported to Slack. And there you go, here is your new public channel unlocked, with your history 🔓

# How to use

1. Checkout this repository
2. `yarn install`
3. `node index.js TOKEN list-of-chans-separated-by-a-space`

You will have a ready to import zip!