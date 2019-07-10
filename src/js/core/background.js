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
   * The bookmark that is currently being displayed.
   *
   * @type {bookmarks.BookmarkTreeNode}
   */
  currentBookmark : null,

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
  async handleResponse (response) {
    if (response.message === 'collect') {
      await kodb.collectAllBookmarks();
      kodb.showNextBookmark();
    }
    else if (response.message === 'delete') {
      browser.bookmarks.remove(response.id);

      kodb.removeFromCollectedBookmarks(response.id);
      kodb.showNextBookmark();
    }
    else if (response.message === 'keep') {
      kodb.removeFromCollectedBookmarks(response.id);
      kodb.showNextBookmark();
    }
    else if (response.message === 'skip') {
      kodb.showNextBookmark();
    }
  },

  /**
   * Calculates the full path of bookmarks.
   *
   * @param {bookmarks.BookmarkTreeNode} bookmark - a single bookmark
   * @param {Array.<string>} path - an array with parts of the bookmark path
   *
   * @returns {Array.<string>} - an array with the full path of all bookmarks
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
   * @returns {Promise} - resolves after completion
   */
  async collectAllBookmarks () {
    const bookmarks = await browser.bookmarks.getTree();

    return new Promise((resolve) => {
      kodb.collectedBookmarks = [];
      kodb.calculateBookmarkPaths(bookmarks[0], []);
      kodb.collectBookmark(bookmarks[0]);

      resolve();
    });
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

  /**
   * This method finds a bookmark by the ID.
   *
   * @param {string} id - the ID of the bookmark
   *
   * @returns {bookmarks.BookmarkTreeNode} - a single bookmark
   */
  findById (id) {
    return kodb.collectedBookmarks.filter((bookmark) => bookmark.id === id)[0];
  },

  /**
   * This method finds the index of a bookmark in the array of collected bookmarks.
   *
   * @param {string} id - the ID of the bookmark
   *
   * @returns {int} - the index in the array
   */
  getIndexById (id) {
    return kodb.collectedBookmarks.findIndex((bookmark) => bookmark.id === id);
  },

  /**
   * This method changes the bookmark that will be displayed next and makes sure that the same bookmark is never
   * displayed twice in a row.
   *
   * @returns {bookmarks.BookmarkTreeNode} - a single bookmark
   */
  showNextBookmark () {
    const { length } = kodb.collectedBookmarks;
    let nextBookmark = kodb.currentBookmark;

    while (nextBookmark === kodb.currentBookmark) {
      nextBookmark = Math.floor(Math.random() * length);
    }

    kodb.currentBookmark = nextBookmark;

    const bookmark = kodb.collectedBookmarks[nextBookmark];
    browser.runtime.sendMessage({ message : 'random-bookmark', bookmark : bookmark });
  },

  /**
   * This method removes a bookmark from the collected bookmarks array.
   *
   * @param {string} id - the ID of the bookmark
   *
   * @returns {void}
   */
  removeFromCollectedBookmarks (id) {
    kodb.collectedBookmarks.splice(kodb.getIndexById(id), 1);
    delete kodb.additionalData[id];
  }
};

browser.browserAction.onClicked.addListener(kodb.openUserInterface);
browser.runtime.onMessage.addListener(kodb.handleResponse);
