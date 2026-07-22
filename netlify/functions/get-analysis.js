// Runs on Netlify's servers only — the API key here is never sent to the browser.
exports.handler = async function (event) {
  const ticker = (event.queryStringParameters.ticker || "").trim().toUpperCase();

  if (!ticker) {
    return respond(400, { error: "Missing ticker symbol." });
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return respond(500, { error: "Server is missing FINNHUB_API_KEY. Set it in Netlify > Site settings > Environment variables." });
  }

  const base = "https://finnhub.io/api/v1";
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d = (date) => date.toISOString().split("T")[0];

  try {
    const [quoteRes, profileRes, metricRes, newsRes] = await Promise.all([
      fetch(`${base}/quote?symbol=${ticker}&token=${apiKey}`),
      fetch(`${base}/stock/profile2?symbol=${ticker}&token=${apiKey}`),
      fetch(`${base}/stock/metric?symbol=${ticker}&metric=all&token=${apiKey}`),
      fetch(`${base}/company-news?symbol=${ticker}&from=${d(weekAgo)}&to=${d(today)}&token=${apiKey}`),
    ]);

    const [quote, profile, metricData, newsRaw] = await Promise.all([
      quoteRes.json(),
      profileRes.json(),
      metricRes.json(),
      newsRes.json(),
    ]);

    if (!quote || quote.c === undefined || quote.c === 0) {
      return respond(404, { error: `No data found for "${ticker}". Check the symbol and try again.` });
    }

    const news = Array.isArray(newsRaw)
      ? newsRaw
          .sort((a, b) => b.datetime - a.datetime)
          .slice(0, 5)
          .map((n) => ({
            headline: n.headline,
            source: n.source,
            url: n.url,
            datetime: n.datetime,
          }))
      : [];

    return respond(200, {
      quote,
      profile,
      metric: metricData.metric || {},
      news,
    });
  } catch (err) {
    return respond(502, { error: "Error reaching the market data provider. Try again shortly." });
  }
};

function respond(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    body: JSON.stringify(bodyObj),
  };
}
