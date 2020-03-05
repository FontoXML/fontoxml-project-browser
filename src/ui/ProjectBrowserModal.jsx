import React, { useCallback, useMemo, useState } from 'react';

import {
	Button,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	StateMessage
} from 'fds/components';

import documentsHierarchy from 'fontoxml-documents/src/documentsHierarchy.js';
import documentsManager from 'fontoxml-documents/src/documentsManager.js';
import FxNodePreviewWithLinkSelector from 'fontoxml-fx/src/FxNodePreviewWithLinkSelector.jsx';
import useXPath, { XPATH_RETURN_TYPES } from 'fontoxml-fx/src/useXPath.js';
import t from 'fontoxml-localization/src/t.js';
import initialDocumentsManager from 'fontoxml-remote-documents/src/initialDocumentsManager.js';
import getClosestStructureViewItem from 'fontoxml-structure/src/getClosestStructureViewItem.js';
import StructureView from 'fontoxml-structure/src/StructureView.jsx';
import useOperation from 'fontoxml-fx/src/useOperation.js';

function ProjectBrowserModal({ cancelModal, data, submitModal }) {
	const [selectedStructureViewItem, setSelectedStructureViewItem] = useState(() =>
		getClosestStructureViewItem(data.nodeId)
	);
	const [potentialLinkableElementId, setPotentialLinkableElementId] = useState(data.nodeId);

	const currentHierarchyNode = useMemo(() => {
		if (!selectedStructureViewItem) {
			return null;
		}

		return documentsHierarchy.find(node => {
			return node.getId() === selectedStructureViewItem.hierarchyNodeId;
		});
	}, [selectedStructureViewItem]);

	const currentTraversalRootNodeId = selectedStructureViewItem
		? selectedStructureViewItem.contextNodeId
		: null;

	const isElementLinkable = useXPath(
		selectedStructureViewItem &&
			'let $selectableNodes := ' +
				data.linkableElementsQuery +
				' return some $node in $selectableNodes satisfies . is $node',
		selectedStructureViewItem
			? documentsManager.getNodeById(selectedStructureViewItem.contextNodeId)
			: null,
		{ expectedResultType: XPATH_RETURN_TYPES.BOOLEAN_TYPE }
	);

	const linkableElementId = isElementLinkable ? potentialLinkableElementId : null;

	const insertOperationInitialData = useMemo(() => {
		return {
			...data,
			nodeId: linkableElementId,
			documentId: currentHierarchyNode
				? currentHierarchyNode.documentReference.documentId
				: null
		};
	}, [currentHierarchyNode, data, linkableElementId]);

	const handleSubmitButtonClick = useCallback(() => {
		submitModal({
			nodeId: potentialLinkableElementId,
			documentId: currentHierarchyNode
				? currentHierarchyNode.documentReference.documentId
				: null
		});
	}, [currentHierarchyNode, potentialLinkableElementId, submitModal]);

	const handleKeyDownCancelOrSubmit = useCallback(
		event => {
			switch (event.key) {
				case 'Escape':
					cancelModal();
					break;
				case 'Enter':
					handleSubmitButtonClick();
					break;
			}
		},
		[cancelModal, handleSubmitButtonClick]
	);

	const handleKeyDownCancelOnly = useCallback(
		event => {
			switch (event.key) {
				case 'Escape':
					cancelModal();
					break;
			}
		},
		[cancelModal]
	);

	const handleStructureViewItemClick = useCallback(item => {
		setSelectedStructureViewItem(item);

		const hierarchyNode = documentsHierarchy.find(
			node => node.getId() === item.hierarchyNodeId && !!node.documentReference
		);

		if (
			hierarchyNode &&
			(hierarchyNode.documentReference === null ||
				!hierarchyNode.documentReference.isLoaded())
		) {
			// This hierarchy node has not been completely finished loading (yet)
			// Make sure that it will
			if (!initialDocumentsManager.canRetryLoadingDocumentForHierarchyNode()) {
				throw new Error(
					'The hierarchy can not contain unloaded documents for editor instances' +
						' that do not allow loading a single document.' +
						' Please implement the "retryLoadingDocumentForHierarchyNode" loading strategy.'
				);
			}

			initialDocumentsManager.retryLoadingDocumentForHierarchyNode(hierarchyNode).then(() =>
				// The hierarchy node should be updated now
				setPotentialLinkableElementId(item.contextNodeId)
			);
			return;
		}

		setPotentialLinkableElementId(item.contextNodeId);
	}, []);

	const handlePreviewItemClick = useCallback(nodeId => {
		setPotentialLinkableElementId(nodeId);
	}, []);

	const operationName = (linkableElementId && data.insertOperationName) || 'do-nothing';

	const { operationState } = useOperation(operationName, insertOperationInitialData);

	const canSubmit = linkableElementId && operationState.enabled;
	const selectedDocumentId = currentHierarchyNode
		? currentHierarchyNode.documentReference.documentId
		: null;

	return (
		<Modal
			isFullHeight
			size="l"
			onKeyDown={canSubmit ? handleKeyDownCancelOrSubmit : handleKeyDownCancelOnly}
		>
			<ModalHeader icon={data.modalIcon} title={data.modalTitle} />

			<ModalBody>
				<ModalContent>
					<ModalContent flexDirection="column" flex="1" isScrollContainer>
						<StructureView
							onItemClick={handleStructureViewItemClick}
							selectedContextNodeId={currentTraversalRootNodeId}
							selectedHierarchyNodeId={
								currentHierarchyNode && currentHierarchyNode.getId()
							}
						/>
					</ModalContent>

					{!selectedDocumentId && (
						<ModalContent flexDirection="column" flex="2">
							<StateMessage
								message={t('Select an item in the list to the left.')}
								paddingSize="m"
								title={t('No item selected')}
								visual="hand-pointer-o"
							/>
						</ModalContent>
					)}
					{selectedDocumentId && (
						<ModalContent
							key={selectedDocumentId + currentTraversalRootNodeId}
							flex="2"
							flexDirection="column"
							isScrollContainer
						>
							<FxNodePreviewWithLinkSelector
								documentId={selectedDocumentId}
								onSelectedNodeChange={handlePreviewItemClick}
								selector={data.linkableElementsQuery}
								selectedNodeId={linkableElementId}
								traversalRootNodeId={currentTraversalRootNodeId}
							/>
						</ModalContent>
					)}
				</ModalContent>
			</ModalBody>

			<ModalFooter>
				<Button label={t('Cancel')} onClick={cancelModal} />

				<Button
					type="primary"
					label={data.modalPrimaryButtonLabel}
					isDisabled={!canSubmit}
					onClick={handleSubmitButtonClick}
				/>
			</ModalFooter>
		</Modal>
	);
}

export default ProjectBrowserModal;
