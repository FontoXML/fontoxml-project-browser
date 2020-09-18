import React, { useCallback, useMemo, useState } from 'react';

import {
	Button,
	ButtonWithValue,
	Flex,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	StateMessage
} from 'fds/components';

import documentsHierarchy from 'fontoxml-documents/src/documentsHierarchy.js';
import documentsManager from 'fontoxml-documents/src/documentsManager.js';
import getNodeId from 'fontoxml-dom-identification/src/getNodeId.js';
import domInfo from 'fontoxml-dom-utils/src/domInfo.js';
import FxNodePreview from 'fontoxml-fx/src/FxNodePreview.jsx';
import FxNodePreviewWithLinkSelector from 'fontoxml-fx/src/FxNodePreviewWithLinkSelector.jsx';
import useOperation from 'fontoxml-fx/src/useOperation.js';
import t from 'fontoxml-localization/src/t.js';
import initialDocumentsManager from 'fontoxml-remote-documents/src/initialDocumentsManager.js';
import getClosestStructureViewItem from 'fontoxml-structure/src/getClosestStructureViewItem.js';
import StructureView from 'fontoxml-structure/src/StructureView.jsx';

function getNewOperationData(
	isMultiSelectEnabled,
	selectedItems,
	potentialLinkableElementId,
	currentHierarchyNode
) {
	return isMultiSelectEnabled
		? {
				selectedItems
		  }
		: {
				nodeId: potentialLinkableElementId,
				documentId: currentHierarchyNode
					? currentHierarchyNode.documentReference.documentId
					: null
		  };
}

function ProjectBrowserModal({ cancelModal, data, submitModal }) {
	const documentNode = documentsManager.getDocumentNode(data.documentId);
	const documentNodeId =
		documentNode && documentNode.documentElement
			? getNodeId(documentNode.documentElement)
			: null;

	const [selectedStructureViewItem, setSelectedStructureViewItem] = useState(() => {
		if (!data.nodeId) {
			return getClosestStructureViewItem(documentNodeId);
		}

		return getClosestStructureViewItem(data.nodeId);
	});
	const [potentialLinkableElementId, setPotentialLinkableElementId] = useState(
		data.nodeId !== null ? data.nodeId : documentNodeId
	);
	const [selectedItems, setSelectedItems] = useState(data.selectedItems || []);

	const currentHierarchyNode = useMemo(() => {
		if (!selectedStructureViewItem) {
			return null;
		}

		return documentsHierarchy.get(selectedStructureViewItem.hierarchyNodeId);
	}, [selectedStructureViewItem]);

	const currentTraversalRootNodeId = selectedStructureViewItem
		? selectedStructureViewItem.contextNodeId
		: null;

	const insertOperationInitialData = useMemo(() => {
		return {
			...data,
			...getNewOperationData(
				!!data.showCheckboxSelector,
				selectedItems,
				potentialLinkableElementId,
				currentHierarchyNode
			)
		};
	}, [currentHierarchyNode, data, potentialLinkableElementId, selectedItems]);

	const handleSubmitButtonClick = useCallback(() => {
		submitModal(
			getNewOperationData(
				!!data.showCheckboxSelector,
				selectedItems,
				potentialLinkableElementId,
				currentHierarchyNode
			)
		);
	}, [
		currentHierarchyNode,
		data.showCheckboxSelector,
		potentialLinkableElementId,
		selectedItems,
		submitModal
	]);

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

		const hierarchyNode = documentsHierarchy.get(item.hierarchyNodeId);
		if (
			hierarchyNode &&
			hierarchyNode.documentReference &&
			!hierarchyNode.documentReference.isLoaded()
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

			initialDocumentsManager.retryLoadingDocumentForHierarchyNode(hierarchyNode).then(() => {
				// The hierarchy node should be updated now
				const hierarchyNode = documentsHierarchy.get(item.hierarchyNodeId);
				if (hierarchyNode && hierarchyNode.documentReference) {
					const traversalRootNode = hierarchyNode.documentReference.getTraversalRootNode();
					const traversalRootNodeId = getNodeId(
						domInfo.isDocument(traversalRootNode)
							? traversalRootNode.documentElement
							: traversalRootNode
					);
					setPotentialLinkableElementId(traversalRootNodeId);

					// When an item is loaded at the contextNodeId to the selectedItem
					setSelectedItems(prevSelectedItems => {
						const selectedItemIndex = prevSelectedItems.findIndex(
							selectedItem =>
								!selectedItem.contextNodeId &&
								selectedItem.hierarchyNodeId === item.hierarchyNodeId
						);
						if (selectedItemIndex !== -1) {
							const newSelectedItems = [...prevSelectedItems];
							newSelectedItems[selectedItemIndex] = {
								hierarchyNodeId: item.hierarchyNodeId,
								contextNodeId: traversalRootNodeId
							};
							return newSelectedItems;
						}
						return prevSelectedItems;
					});
				}
			});
			return;
		}

		setPotentialLinkableElementId(item.contextNodeId);
	}, []);

	const handleCheckboxClick = useCallback(
		({ node }) => {
			const newSelectedItems = [...selectedItems];
			const selectedNodeIndex = newSelectedItems.findIndex(
				item =>
					item.hierarchyNodeId === node.hierarchyNodeId &&
					(!item.contextNodeId || item.contextNodeId === node.contextNodeId)
			);

			if (selectedNodeIndex === -1) {
				newSelectedItems.push({
					hierarchyNodeId: node.hierarchyNodeId,
					contextNodeId: node.contextNodeId
				});
			} else {
				newSelectedItems.splice(selectedNodeIndex, 1);
			}
			setSelectedItems(newSelectedItems);
			handleStructureViewItemClick(node);
		},
		[handleStructureViewItemClick, selectedItems]
	);

	const handlePreviewItemClick = useCallback(nodeId => {
		setPotentialLinkableElementId(nodeId);
	}, []);

	const handleClearSelection = useCallback(() => {
		setSelectedItems([]);
	}, []);

	const operationName =
		((data.showCheckboxSelector || potentialLinkableElementId) && data.insertOperationName) ||
		'do-nothing';

	const { operationState } = useOperation(operationName, insertOperationInitialData);

	const canSubmit =
		(data.showCheckboxSelector || potentialLinkableElementId) && operationState.enabled;
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
							onItemCheckboxClick={handleCheckboxClick}
							onItemClick={handleStructureViewItemClick}
							checkedItems={selectedItems}
							showCheckboxSelector={data.showCheckboxSelector}
							selectedContextNodeId={currentTraversalRootNodeId}
							selectedHierarchyNodeId={
								currentHierarchyNode && currentHierarchyNode.getId()
							}
						/>
					</ModalContent>

					{!selectedDocumentId && (
						<ModalContent flexDirection="column" flex="2">
							<StateMessage
								message={
									data.showCheckboxSelector
										? t(
												'Select an item to preview it and use the checkboxes to select items to insert.'
										  )
										: t('Select an item in the list to the left.')
								}
								paddingSize="m"
								title={t('No item selected')}
								visual={
									data.showCheckboxSelector ? 'check-square' : 'hand-pointer-o'
								}
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
							{data.showCheckboxSelector ? (
								<FxNodePreview
									documentId={selectedDocumentId}
									traversalRootNodeId={currentTraversalRootNodeId}
								/>
							) : (
								<FxNodePreviewWithLinkSelector
									documentId={selectedDocumentId}
									onSelectedNodeChange={handlePreviewItemClick}
									selector={data.linkableElementsQuery}
									selectedNodeId={potentialLinkableElementId}
									traversalRootNodeId={currentTraversalRootNodeId}
								/>
							)}
						</ModalContent>
					)}
				</ModalContent>
			</ModalBody>

			<ModalFooter>
				<Flex spaceSize="m">
					<Button label={t('Cancel')} onClick={cancelModal} />
					{data.showCheckboxSelector && (
						<ButtonWithValue
							icon={'times'}
							buttonLabel={t('Clear selection')}
							onClick={handleClearSelection}
							valueLabel={t(' {size} ', {
								size: selectedItems.length
							})}
						/>
					)}
				</Flex>

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
