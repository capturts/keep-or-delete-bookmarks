'use strict';

const UI_PAGE = 'html/ui.html';

/**
 * @exports kodb
 */
const kodb = {
  /**
   * An array containing all bookmarks.
   *
   * @type {Array.<bookmarks.BookmarkTreeNode>}
   */
  collectedBookmarks : [],

  /**
   * Additional data stored for bookmarks. In current version it only contains the full bookmark path.
   *
   * @type {Array.<string>}
   */
  additionalData : [],

  /**
   * Fired when the toolbar icon is clicked. This method is used to open the user interface in a new tab or to switch
   * to the tab with the user interface if the user interface is already opened.
   *
   * @returns {void}
   */
  openUserInterface () {
    const url = browser.extension.getURL(UI_PAGE);

    browser.tabs.query({}, (tabs) => {
      let tabId = null;

      for (const tab of tabs) {
        if (tab.url === url) {
          tabId = tab.id;
          break;
        }
      }

      if (tabId) {
        browser.tabs.update(tabId, { active : true });
      }
      else {
        browser.tabs.create({ url });
      }
    });
  },

  /**
   * Fired when a message is sent from the UI script to the background script.
   *
   * @param {Object} response - contains the response from the UI script
   *
   * @returns {void}
   */
  handleResponse (response) {
    if (response.message === 'collect') {
      kodb.collectAllBookmarks();
    }
  },

  /**
   * Calculates the full path of bookmarks.
   *
   * @param {bookmarks.BookmarkTreeNode} bookmark - a single bookmark
   * @param {Array.<string>} path - an array with parts of the path of the bookmark
   *
   * @returns {Array.<string>} - An array with the full path of all bookmarks
   */
  calculateBookmarkPaths (bookmark, path) {
    if (bookmark.title) {
      path.push(bookmark.title);
    }

    if (bookmark.children) {
      for (const child of bookmark.children) {
        kodb.calculateBookmarkPaths(child, path);
      }
    }
    else {
      if (!kodb.additionalData[bookmark.id]) {
        kodb.additionalData[bookmark.id] = {};
      }

      kodb.additionalData[bookmark.id].path = path.slice(0, -1);
    }

    path.pop();

    return kodb.additionalData;
  },

  /**
   * This method is used to start collecting all bookmarks.
   *
   * @returns {void}
   */
  async collectAllBookmarks () {
    const bookmarks = await browser.bookmarks.getTree();

    kodb.collectedBookmarks = [];
    kodb.calculateBookmarkPaths(bookmarks[0], []);
    kodb.collectBookmark(bookmarks[0]);
  },

  /**
   * This recursive method pushes a single bookmark to a global array of bookmarks and calls itself for each child.
   *
   * @param {bookmarks.BookmarkTreeNode} bookmark - a single bookmark
   *
   * @returns {void}
   */
  collectBookmark (bookmark) {
    // we only collect bookmarks, no folders or seperators
    if (bookmark.type === 'bookmark') {
      const { id, title, url } = bookmark;
      const { path } = kodb.additionalData[id];

      kodb.collectedBookmarks.push({ id, title, url, path });
    }

    if (bookmark.children) {
      for (const child of bookmark.children) {
        kodb.collectBookmark(child);
      }
    }
  },

  findById (id) {
    return kodb.collectedBookmarks.filter((bookmark) => bookmark.id === id)[0];
  }
};

browser.browserAction.onClicked.addListener(kodb.openUserInterface);
browser.runtime.onMessage.addListener(kodb.handleResponse);
