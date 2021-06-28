import uiManager from 'fontoxml-modular-ui/src/uiManager';

import ProjectBrowserModal from './ui/ProjectBrowserModal';

export default function install(): void {
	uiManager.registerReactComponent(
		'ProjectBrowserModal',
		ProjectBrowserModal
	);
}
