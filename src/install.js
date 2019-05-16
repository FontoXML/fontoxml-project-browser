import uiManager from 'fontoxml-modular-ui/src/uiManager.js';
import ProjectBrowserModal from './ui/ProjectBrowserModal.jsx';

export default function install() {
	uiManager.registerReactComponent('ProjectBrowserModal', ProjectBrowserModal);
}
