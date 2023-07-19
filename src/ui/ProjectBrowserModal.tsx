import type { FC, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

import {
	Button,
	ButtonWithValue,
	Flex,
	Modal,
	ModalBody,
	ModalBodyToolbar,
	ModalContent,
	ModalFooter,
	ModalHeader,
	SpinnerIcon,
	StateMessage,
} from 'fontoxml-design-system/src/components';
import type { FdsStateMessageConnotation } from 'fontoxml-design-system/src/types';
import documentsHierarchy from 'fontoxml-documents/src/documentsHierarchy';
import type DocumentsHierarchyNode from 'fontoxml-documents/src/DocumentsHierarchyNode';
import documentsManager from 'fontoxml-documents/src/documentsManager';
import type { DocumentId, HierarchyNodeId } from 'fontoxml-documents/src/types';
import getNodeId from 'fontoxml-dom-identification/src/getNodeId';
import type { NodeId } from 'fontoxml-dom-identification/src/types';
import domInfo from 'fontoxml-dom-utils/src/domInfo';
import type {
	FontoDocumentNode,
	FontoNode,
} from 'fontoxml-dom-utils/src/types';
import FxNodePreview from 'fontoxml-fx/src/FxNodePreview';
import FxNodePreviewWithLinkSelector from 'fontoxml-fx/src/FxNodePreviewWithLinkSelector';
import FxVirtualForestCollapseButtons from 'fontoxml-fx/src/FxVirtualForestCollapseButtons';
import type { ModalProps } from 'fontoxml-fx/src/types';
import useOperation from 'fontoxml-fx/src/useOperation';
import t from 'fontoxml-localization/src/t';
import type { OperationName } from 'fontoxml-operations/src/types';
import initialDocumentsManager from 'fontoxml-remote-documents/src/initialDocumentsManager';
import type { XPathTest } from 'fontoxml-selectors/src/types';
import getClosestStructureViewItem from 'fontoxml-structure/src/getClosestStructureViewItem';
import StructureView from 'fontoxml-structure/src/StructureView';

const INSTANCE_ID = 'structure-view-project-browser-modal-instance-id';

type CheckedItem = { hierarchyNodeId: HierarchyNodeId; contextNodeId: NodeId };

function getNewOperationData(
	isMultiSelectEnabled: boolean,
	checkedItems: CheckedItem[],
	potentialLinkableElementId: NodeId,
	currentHierarchyNode: DocumentsHierarchyNode
) {
	return isMultiSelectEnabled
		? {
				selectedItems: checkedItems,
		  }
		: {
				nodeId: potentialLinkableElementId,
				documentId: currentHierarchyNode
					? currentHierarchyNode.documentReference.documentId
					: null,
		  };
}

const ProjectBrowserModal: FC<
	ModalProps<
		{
			documentId: DocumentId;
			insertOperationName: OperationName;
			linkableElementsQuery?: string;
			modalIcon: string;
			modalPrimaryButtonLabel: string;
			modalTitle: string;
			nodeId: NodeId;
			selectedItems: CheckedItem[];
			showCheckboxSelector: XPathTest;
		},
		| { documentId: DocumentId; nodeId: NodeId }
		| { selectedItems: CheckedItem[] }
	>
> = ({ cancelModal, data, submitModal }) => {
	const documentNode = documentsManager.getDocumentNode(
		data.documentId
	) as FontoDocumentNode<'readable'>;
	const documentNodeId =
		documentNode && documentNode.documentElement
			? getNodeId(documentNode.documentElement)
			: null;

	const [selectedStructureViewItem, setSelectedStructureViewItem] = useState(
		() => {
			if (!data.nodeId) {
				return getClosestStructureViewItem(documentNodeId);
			}

			return getClosestStructureViewItem(data.nodeId);
		}
	);
	const [potentialLinkableElementId, setPotentialLinkableElementId] =
		useState(data.nodeId !== null ? data.nodeId : documentNodeId);
	const [checkedItems, setCheckedItems] = useState(data.selectedItems || []);

	const [isDocumentBroken, setIsDocumentBroken] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const currentHierarchyNode = useMemo(() => {
		if (!selectedStructureViewItem) {
			return null;
		}

		return documentsHierarchy.get(
			selectedStructureViewItem.hierarchyNodeId
		);
	}, [selectedStructureViewItem]);

	const currentTraversalRootNodeId = selectedStructureViewItem
		? selectedStructureViewItem.contextNodeId
		: null;

	const insertOperationInitialData = useMemo(() => {
		return {
			...data,
			...getNewOperationData(
				!!data.showCheckboxSelector,
				checkedItems,
				potentialLinkableElementId,
				currentHierarchyNode
			),
		};
	}, [currentHierarchyNode, data, potentialLinkableElementId, checkedItems]);

	const handleSubmitButtonClick = useCallback(() => {
		submitModal(
			getNewOperationData(
				!!data.showCheckboxSelector,
				checkedItems,
				potentialLinkableElementId,
				currentHierarchyNode
			)
		);
	}, [
		currentHierarchyNode,
		data.showCheckboxSelector,
		potentialLinkableElementId,
		checkedItems,
		submitModal,
	]);

	const handleKeyDownCancelOrSubmit = useCallback(
		(event) => {
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
		(event) => {
			switch (event.key) {
				case 'Escape':
					cancelModal();
					break;
			}
		},
		[cancelModal]
	);
	const handleStructureViewItemClick = useCallback((item) => {
		setSelectedStructureViewItem(item);
		setPotentialLinkableElementId(null);

		const hierarchyNode = documentsHierarchy.get(item.hierarchyNodeId);
		if (
			hierarchyNode &&
			hierarchyNode.documentReference &&
			!hierarchyNode.documentReference.isLoaded()
		) {
			// This hierarchy node has not been completely finished loading (yet)
			// Make sure that it will
			if (
				!initialDocumentsManager.canRetryLoadingDocumentForHierarchyNode()
			) {
				throw new Error(
					'The hierarchy can not contain unloaded documents for editor instances' +
						' that do not allow loading a single document.' +
						' Please implement the "retryLoadingDocumentForHierarchyNode" loading strategy.'
				);
			}

			setIsLoading(true);

			void initialDocumentsManager
				.retryLoadingDocumentForHierarchyNode(hierarchyNode)
				.then(() => {
					setIsLoading(false);
					// The hierarchy node should be updated now
					const hierarchyNode = documentsHierarchy.get(
						item.hierarchyNodeId
					);
					if (hierarchyNode && hierarchyNode.documentReference) {
						const traversalRootNode =
							hierarchyNode.documentReference.getTraversalRootNode() as FontoNode<'readable'>;
						const traversalRootNodeId = getNodeId(
							domInfo.isDocument(traversalRootNode)
								? traversalRootNode.documentElement
								: traversalRootNode
						);
						setPotentialLinkableElementId(traversalRootNodeId);

						// When an item is loaded add the contextNodeId to the checkedItem
						setCheckedItems((prevCheckedItems) => {
							const selectedItemIndex =
								prevCheckedItems.findIndex(
									(selectedItem) =>
										!selectedItem.contextNodeId &&
										selectedItem.hierarchyNodeId ===
											item.hierarchyNodeId
								);
							if (selectedItemIndex !== -1) {
								const newSelectedItems = [...prevCheckedItems];
								newSelectedItems[selectedItemIndex] = {
									hierarchyNodeId: item.hierarchyNodeId,
									contextNodeId: traversalRootNodeId,
								};
								return newSelectedItems;
							}
							return prevCheckedItems;
						});
					}
				})
				.catch((_error) => {
					setIsLoading(false);
					setIsDocumentBroken(true);
				});

			return;
		}
		setIsLoading(false);
		setIsDocumentBroken(false);
		setPotentialLinkableElementId(item.contextNodeId);
	}, []);

	const handleCheckboxClick = useCallback(
		({ node }) => {
			const newCheckedItems = [...checkedItems];
			const checkedItemIndex = newCheckedItems.findIndex(
				(item) =>
					item.hierarchyNodeId === node.hierarchyNodeId &&
					(!item.contextNodeId ||
						item.contextNodeId === node.contextNodeId)
			);

			if (checkedItemIndex === -1) {
				newCheckedItems.push({
					hierarchyNodeId: node.hierarchyNodeId,
					contextNodeId: node.contextNodeId,
				});
			} else {
				newCheckedItems.splice(checkedItemIndex, 1);
			}
			setCheckedItems(newCheckedItems);
			handleStructureViewItemClick(node);
		},
		[handleStructureViewItemClick, checkedItems]
	);

	const handlePreviewItemClick = useCallback((nodeId) => {
		setPotentialLinkableElementId(nodeId);
	}, []);

	const handleClearSelection = useCallback(() => {
		setCheckedItems([]);
	}, []);

	const operationName =
		((data.showCheckboxSelector || potentialLinkableElementId) &&
			data.insertOperationName) ||
		'do-nothing';

	const { operationState } = useOperation(
		operationName,
		insertOperationInitialData
	);

	const canSubmit =
		(data.showCheckboxSelector || potentialLinkableElementId) &&
		operationState.enabled;
	const selectedDocumentId = currentHierarchyNode
		? currentHierarchyNode.documentReference.documentId
		: null;

	let stateIcon: ReactNode = 'hand-pointer-o';
	let stateMessage = t('Select an item in the list to the left.');
	let stateConnotation: FdsStateMessageConnotation = 'muted';
	let stateTitle = t('No item selected');

	if (isLoading) {
		stateIcon = <SpinnerIcon />;
		stateMessage = null;
		stateConnotation = 'muted';
		stateTitle = null;
	}
	if (isDocumentBroken) {
		stateIcon = 'fas fa-times';
		stateMessage = t('Select a different item in the list to the left.');
		stateConnotation = 'error';
		stateTitle = t('This document could not be found');
	}
	return (
		<Modal
			isFullHeight
			size="l"
			onKeyDown={
				canSubmit
					? handleKeyDownCancelOrSubmit
					: handleKeyDownCancelOnly
			}
		>
			<ModalHeader icon={data.modalIcon} title={data.modalTitle} />

			<ModalBody>
				<ModalBodyToolbar>
					<FxVirtualForestCollapseButtons
						virtualForestManagerId={INSTANCE_ID}
					/>
				</ModalBodyToolbar>
				<ModalContent>
					<ModalContent
						flexDirection="column"
						flex={data.showCheckboxSelector ? '2' : '1'}
						isScrollContainer
					>
						<StructureView
							checkedItems={checkedItems}
							instanceId={INSTANCE_ID}
							onItemCheckboxClick={handleCheckboxClick}
							onItemClick={handleStructureViewItemClick}
							selectedContextNodeId={currentTraversalRootNodeId}
							selectedHierarchyNodeId={
								currentHierarchyNode &&
								currentHierarchyNode.getId()
							}
							showCheckboxSelector={data.showCheckboxSelector}
							showNodeStatus
							showRemoteDocumentState
						/>
					</ModalContent>

					{!selectedDocumentId && (
						<ModalContent
							flexDirection="column"
							flex={data.showCheckboxSelector ? '3' : '2'}
						>
							<StateMessage
								message={
									data.showCheckboxSelector
										? t(
												'Select an item to preview it and use the checkboxes to select items to insert.'
										  )
										: stateMessage
								}
								paddingSize="m"
								title={stateTitle}
								visual={
									data.showCheckboxSelector
										? 'check-square'
										: stateIcon
								}
								connotation={stateConnotation}
							/>
						</ModalContent>
					)}
					{selectedDocumentId && (
						<ModalContent
							key={
								selectedDocumentId + currentTraversalRootNodeId
							}
							flex={data.showCheckboxSelector ? '3' : '2'}
							flexDirection="column"
							isScrollContainer
						>
							{data.showCheckboxSelector ? (
								<FxNodePreview
									documentId={selectedDocumentId}
									traversalRootNodeId={
										currentTraversalRootNodeId
									}
								/>
							) : (
								<FxNodePreviewWithLinkSelector
									documentId={selectedDocumentId}
									onSelectedNodeChange={
										handlePreviewItemClick
									}
									selector={data.linkableElementsQuery}
									selectedNodeId={potentialLinkableElementId}
									traversalRootNodeId={
										currentTraversalRootNodeId
									}
								/>
							)}
						</ModalContent>
					)}
				</ModalContent>
			</ModalBody>

			<ModalFooter>
				<Button label={t('Cancel')} onClick={cancelModal} />
				<Flex spaceSize="l">
					{data.showCheckboxSelector && (
						<ButtonWithValue
							buttonLabel={t('Clear selection')}
							onClick={handleClearSelection}
							valueLabel={` ${checkedItems.length} `}
						/>
					)}

					<Button
						type="primary"
						label={data.modalPrimaryButtonLabel}
						isDisabled={!canSubmit}
						onClick={handleSubmitButtonClick}
					/>
				</Flex>
			</ModalFooter>
		</Modal>
	);
};

export default ProjectBrowserModal;
