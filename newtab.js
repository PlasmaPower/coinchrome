var CACHED_NEW_PRICE_KEY = "CACHED_NEW_PRICE_KEY";
var CACHED_OLD_PRICE_KEY = "CACHED_OLD_PRICE_KEY";
var ACCESS_TOKEN_KEY = "ACCESS_TOKEN_KEY";
var REFRESH_TOKEN_KEY = "REFRESH_TOKEN_KEY";
var TOTAL_BITCOIN = "TOTAL_BITCOIN";
var CLIENT_ID = "c1f51ed609f14a95206df4ff13125b4462582220e8a9671f928f15e17f2d31c3",
    CLIENT_SECRET = "a726b2f473e372c0d9d776bda852e302be33aeb033ee16efc4eee40bfeb0df1f",
    REDIRECT_URI = "https://jfkebmajolhghoaeiejbadalhlaknoef.chromiumapp.org/callback";

function displayPrice(price, currency) {
  element = document.getElementById("bitcoin-price");
  element.textContent = price + " " + currency;
}

function fetchPriceDifference() {
  fetch('https://api.coinbase.com/v2/prices/historic')
  .then(function(response) {
    return response.json();
  })
  .then(function(data) {
    var currentPrice = parseFloat(data["data"]["prices"][0]["price"]);
    var oldPrice = parseFloat(data["data"]["prices"][23]["price"]);
    localStorage.setItem(CACHED_NEW_PRICE_KEY, currentPrice);
    localStorage.setItem(CACHED_OLD_PRICE_KEY, oldPrice);
    calculateDifference();
  })
  .catch(function(err) {
    console.error('Unable to get historic prices:', err);
  });
}

function calculateDifference() {
  var currentPrice = localStorage.getItem(CACHED_NEW_PRICE_KEY);
  var oldPrice = localStorage.getItem(CACHED_OLD_PRICE_KEY);
  var totalBitcoin = localStorage.getItem(TOTAL_BITCOIN);

  if (currentPrice) {
    displayPrice(currentPrice, "USD");

    if (totalBitcoin) {
      var difference = currentPrice - oldPrice;
      var delta = Math.round((difference * totalBitcoin) * 100) / 100;
      var text;
      if (delta < 0)
        text = "Your bitcoin is up " + delta + " USD today"
      else
        text = "Your bitcoin is down " + delta + " USD today"

      element = document.getElementById("gain-and-pain");
      element.textContent = text;
      element.style.display = "block";
    }
  }
}

function fetchGainAndPain() {
  var accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (!accessToken)
    return restoreOriginalState(true);

  fetch('https://api.coinbase.com/v2/accounts?limit=100', {
    headers: { "Authorization": "Bearer " + accessToken },
  })
  .then(function(response) {
    if (response.status == 401)
      return refreshTokens();

    return response.json();
  })
  .then(function(json) {
    var accountData = json.data;
    var totalBitcoin = 0;
    accountData.forEach(function(account) {
      if (account.currency == "BTC")
        totalBitcoin += parseFloat(account.balance.amount);
    });
    localStorage.setItem(TOTAL_BITCOIN, totalBitcoin);
    fetchPriceDifference();
  })
  .catch(function(err) {
    console.error('Unable to get the latest price:', err);
  });
}

function connectCoinbase() {
  console.log("https://www.coinbase.com/oauth/authorize?client_id=" + CLIENT_ID +"&redirect_uri="+ encodeURIComponent(REDIRECT_URI) +"&response_type=code&scope=wallet%3Aaccounts%3Aread&account=all")
  document.getElementById("connect").style.display = "none";
  chrome.identity.launchWebAuthFlow({
    'url': "https://www.coinbase.com/oauth/authorize?client_id=" + CLIENT_ID +"&redirect_uri="+ encodeURIComponent(REDIRECT_URI) +"&response_type=code&scope=wallet%3Aaccounts%3Aread&account=all",
    'interactive': true
  },
  function(redirect_url) {
    var code = redirect_url.split("=")[1]
    fetch('https://www.coinbase.com/oauth/token', {
      method: 'post',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      })
    }).then(function(response) {
      if (response.ok) {
        response.json().then(function(data) {
          localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
          localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
          fetchGainAndPain();
        });
      }
    }).catch(function(err) {
      console.error(err);
    });
  });
}

function refreshTokens() {
  fetch('https://www.coinbase.com/oauth/token', {
    method: 'post',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: localStorage.getItem(REFRESH_TOKEN_KEY),
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    })
  }).then(function(response) {
    if (response.ok) {
      response.json().then(function(data) {
        localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
        fetchGainAndPain();
      });
    } else {
      clearTokens();
    };
  }).catch(function(err) {
    console.error(err);
  });
}

function restoreOriginalState(reload) {
  localStorage.clear();
  document.getElementById("connect").style.display = "block";
}

document.addEventListener("DOMContentLoaded", function() {
  // Load cached price and update
  calculateDifference();

  // Load new data
  fetchPriceDifference();
  fetchGainAndPain();

  // Bind events
  var linkElem = document.getElementById("connect");
  linkElem.addEventListener("click", function(event) {
    event.preventDefault();
    connectCoinbase();
  }, false);
});