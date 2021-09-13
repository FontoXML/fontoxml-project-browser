---
category: add-on/fontoxml-project-browser
fontosdk: true
---

# Project browser library

This add-on exposes the {@link operation/open-project-browser-modal} operation for opening a project browser. This browser allows the user to browse the documents currently opened in the editor and select one of the elements present in one of those documents. This, for example, can be used while selecting a target for a link.

## Getting started

This add-on can be added to an editor by selecting the checkbox for this add-on in the [SDK portal](http://sdk.fontoxml.com/). Then install this add-on [as usual](https://developers.fontoxml.com/install-add-on).

## Usage of open-project-browser-modal

This browser can be used by adding the following operation step to your operation:

```
{
    "type": "operation/open-project-browser-modal"
}
```

-   The elements which should be selectable by the user can be set by providing a `linkableElementsQuery`. This is an {@link XPathQuery}.
-   When this modal is used to edit an existing link, the `documentId` and `nodeId` properties can be used to set the selection on the original document and element.
-   Use `insertOperationName` to disable the primary button based on the operation state.
-   The modal icon, title and primary button label can be set with the `modalIcon`, `modalTitle` and `modalPrimaryButtonLabel` respectively.

For more information, see {@link operation/open-project-browser-modal}.

## Usage of open-project-browser-modal-with-multi-select

This browser can be used by adding the following operation step to your operation:

```
{
    "type": "operation/open-project-browser-modal-with-multi-select"
}
```

-   The structure view items which should be selectable by the user can be set by providing a `showCheckboxSelector`. This is an {@link XPathTest}.
-   When this modal is used to edit an existing link(s), the `selectedItems` property can be used to select the checkboxes on the structure view items.
-   Use `insertOperationName` to disable the primary button based on the operation state.
-   The modal icon, title and primary button label can be set with the `modalIcon`, `modalTitle` and `modalPrimaryButtonLabel` respectively.

For more information, see {@link operation/open-project-browser-modal-with-multi-select}.

# Contributing

This package can serve as a base for custom versions of the project browser. It can be forked by
checking it out directly in the `packages` folder of an editor. When making a fork, consider keeping
it up-to-date with new Fonto Editor versions when they release.

We highly appreciate pull requests if you find a bug. For more general improvements or new features,
please file a [support.fontoxml.com](support request). That way, we can think along and make sure an
improvement is made in a way that benefits all users of this package.
