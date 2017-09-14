# Add-on fontoxml-project-browser

This add-on exposes the {@link operation/open-project-browser} operation for opening a project browser. This browser allows the user to browse the documents currently opened in the editor and select one of the elements present in one of those documents. This, for example, can be used while selecting a target for a link.

## Getting started

This add-on can be added to an editor by selecting the checkbox for this add-on in the [SDK portal](http://sdk.fontoxml.com/). Then install this add-on [as usual](https://developers.fontoxml.com/install-add-on).

## Usage

This browser can be used by adding the following operation step to your operation:

```
{
    "type": "operation/open-project-browser"
}
```

The elements which should be selectable by the user can be set by providing a `linkableElementsQuery`. This is an {@link XPathQuery}.

When this modal is used to edit an existing link, the `documentId` and `nodeId` properties can be used to set the selection on the original document and element. In addition to these two properties, the modal title and primary button label can be set with the `modalTitle` and `modalPrimaryButtonLabel` respectively.

For more information, see {@link operation/open-project-browser}.
