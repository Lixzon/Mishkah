# Mishkah Rafiq online and offline guidance

Mishkah keeps its reviewed local guide available offline. Online answers are
optional and require a deployed HTTPS service; no AI provider key is included
in the app.

## Configure the online service

Set `EXPO_PUBLIC_RAFIQ_API_URL` in Mishkah's build environment to its
answer-and-sources endpoint. Keep provider credentials on the server.

Mishkah sends `{ "query": "question", "locale": "en" }` and expects
`{ "answer": "response", "sources": [{ "title": "Source", "url":
"https://example.org/article" }] }`. Mishkah requires HTTPS citations and
limits the answer length and number of displayed sources.

Mishkah needs to be rebuilt after changing its endpoint configuration. Without
an endpoint, Rafiq remains offline-only and the interface should say that
online answers are not configured rather than imply they are live.
