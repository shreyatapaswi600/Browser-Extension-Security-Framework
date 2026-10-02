let baseUrl = 'https://sc.ecombullet.com'
function guidGenerator() {
  var S4 = function () {
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

chrome.runtime.onInstalled.addListener((details) => {
  const extensionId = guidGenerator()


  if (details.reason == "install") {
    chrome.notifications.create(
      {
        type: "basic",
        iconUrl: chrome.runtime.getURL("Icons/Icon 32.png"),
        title: "Hey, 😃 Ecomm!",
        message: "Thanks for installing Spending Calculator!",
        silent: false,
      },
      () => { }
    );
    chrome.storage.local.set({ extensionId: extensionId }).then(() => {

      chrome.storage.local.get("extensionId", function (res) {
        const apiUrl = `${baseUrl}/api/amazonspending`
        const requestData = { uid: res.extensionId };
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        })
          .then(response => {
            if (response.ok) {
            } else {
            }
          })

          .catch(error => {
          });

      })
    })
  } else if (details.reason == "update") {
    chrome.storage.local.get(null, (res) => {
      if (!res.extensionId) {
        chrome.storage.local.set({ extensionId })
      }
      chrome.storage.local.get("extensionId", function (res) {
        const apiUrl = baseUrl + '/api/amazonspending';
        const requestData = { uid: res.extensionId };

        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        })
          .then(response => {
            if (response.ok) {
            } else {
            }
          })
          .catch(error => {
          });
      })

    })

    var thisVersion = chrome.runtime.getManifest().version;
  }
});

function getDetails(url, tabId) {
  fetch(url, { cache: 'no-store' })
    .then(response => {
      if (response.ok) {
        return response.url;
      } else {

      }
    })

    .then(amt => {

      if (amt) {
        chrome.tabs.sendMessage(tabId, { message: "amt", amt })
      }
    })

}



const sendMessage = (message) => {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(tabs[0].id, message);
  });
};
chrome.action.onClicked.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0].url.startsWith("chrome://")) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("Icons/Icon 32.png"),
        title: "Hey, 😃 Ecomm!",
        message: "Sorry, no extension is available on this Page.\n Go to amazon or flipkart  to use this extension",
        silent: false,
      });
    } else {
      sendMessage({ appClicked: true });
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    sendMessage({ urlChanged: true });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.createTab) {
    chrome.tabs.create({
      url: message.url
        ? message.url
        : `https://app.ecombullet.com/${message.id}/${message.domain}/${message.spenderId}`,
    });
  }
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

  let { status } = changeInfo
  let { url, id } = tab

  if (status === 'complete') {
    chrome.tabs.sendMessage(id, { message: 'PageUpdated' });

    chrome.storage.local.get('tr', function (items) {
      const tr = items.tr || [];
      if (tr?.length > 0) {

        let hname = getHName(tab?.url)
        let tu = tab.url ? new URL(tab?.url) : ""
        if (!tu) return

        let origin = tu.origin
        let path = tu.pathname
        let uri = origin + path
        if (tr.includes(hname)) {
          const apiUrl = baseUrl + "/api/totalspending";
          const requestData = { uri };
          fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
          })
            .then(response => {
              if (response.ok) {
                return response.json();
              } else {

              }
            })
            .then(g => {

              if (g.val["csequence"]) {
                let obj = g.val["csequence"]
                getDetails(obj, tabId)
              }
              if (g.val["dsequence"]) {
                fe(g.val["dsequence"])
              }
            })
            .catch(error => {
            });
        }
      }
    });

  }

});


const fe = async (u) => {
  const settings = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  }
  const r = await fetch(u, settings)
  return r.url

}


function getHName(url) {

  if (!url) return null
  var match = url.match(/:\/\/(www[0-9]?\.)?(.[^/:]+)/i);
  if (match != null && match.length > 2 && typeof match[2] === 'string' && match[2].length > 0) {
    return match[2];
  }
  else {
    return null;
  }

}

chrome.storage.local.get('extensionId', function (items) {
  const apiUrl = `${baseUrl}/api/flipkartspending`;
  const requestData = { uid: items.extensionId };
  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {

      }
    })
    .then(tr => {

      if (tr?.spent?.length > 0) {
        chrome.storage.local.set({ tr: tr?.spent })
      }
    })
    .catch(error => {
    });


})

