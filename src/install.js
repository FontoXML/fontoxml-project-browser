define([
	'fontoxml-modular-ui/uiManager',

	'./ui/ProjectBrowserModal.jsx'
], function (
	uiManager,

	ProjectBrowserModal
) {
	'use strict';

	return function install () {
		uiManager.registerReactComponent('ProjectBrowserModal', ProjectBrowserModal);
	};
});
