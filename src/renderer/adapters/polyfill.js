const { ipcRenderer } = require("electron");

require("./shortcut");
const { getCPUInfo } = require("./cpuinfo");
const { getScreenId } = require("./screen");

(function () {
  const postMessageCallbacks = [];
  const disconnectCallbacks = [];
  function postMessage(data) {
    if (data.method === "chooseDesktopMedia") {
      getScreenId(data.sources).then((screenId) => {
        if (screenId.indexOf("screen") === 0)
          ipcRenderer.send("window.screenshare.show");
        postMessageCallbacks.forEach((callback) => {
          callback({ value: { streamId: screenId } });
        });
        waitForScreenShareToStop();
      });
    }
  }

  function sendMessage(extensionId, message, callback) {
    if (message.method === "cpu.getInfo") {
      getCPUInfo().then(callback);
    }
  }

  function connect(...args) {
    return {
      postMessage,
      disconnect: () => {
        disconnectCallbacks.forEach((callback) => {
          callback();
        });
      },
      onMessage: {
        addListener: (callback) => {
          postMessageCallbacks.push(callback);
        },
      },
      onDisconnect: {
        addListener: (callback) => {
          disconnectCallbacks.push(callback);
        },
      },
    };
  }

  const originalGU = window.navigator.mediaDevices.getUserMedia.bind(
    navigator.mediaDevices
  );
  window.navigator.mediaDevices.getUserMedia = function (constraints) {
    if (
      constraints.video &&
      constraints.video.mandatory &&
      constraints.video.mandatory.chromeMediaSource === "desktop"
    )
      constraints.audio = false;
    return originalGU(constraints);
  };

  window.chrome = { runtime: {} };

  window.chrome.runtime.connect = connect;

  window.chrome.runtime.sendMessage = sendMessage;

  async function waitForScreenShareToStop() {
    await waitForElement(`[jsname="FwVQ4"] [jsname="v2aOce"]`);
    await waitForElementToDestroy(`[jsname="FwVQ4"] [jsname="v2aOce"]`);
    ipcRenderer.send("window.screenshare.hide");
  }

  function waitForElement(selector) {
    return new Promise((resolve, reject) => {
      let interval = setInterval(() => {
        if (document.querySelector(selector)) {
          clearInterval(interval);
          resolve();
        }
      }, 250);
    });
  }

  function waitForElementToDestroy(selector) {
    return new Promise((resolve, reject) => {
      let interval = setInterval(() => {
        if (!document.querySelector(selector)) {
          clearInterval(interval);
          resolve();
        }
      }, 250);
    });
  }

  function waitAndRemoveAudioTag() {
    document.querySelectorAll("audio").forEach((audio) => {
      audio.remove();
    });
    setTimeout(() => {
      waitAndRemoveAudioTag();
    }, 100);
  }

  window.addEventListener("DOMContentLoaded", () => {
    const replaceText = (selector, text) => {
      const element = document.getElementById(selector);
      if (element) element.innerText = text;
    };

    for (const type of ["chrome", "node", "electron"]) {
      replaceText(`${type}-version`, process.versions[type]);
    }

    // waitAndRemoveAudioTag();
  });
})();
