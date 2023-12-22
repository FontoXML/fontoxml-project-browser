import type { ComponentProps, FC, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import blueprintQuery from 'fontoxml-blueprints/src/blueprintQuery';
import readOnlyBlueprint from 'fontoxml-blueprints/src/readOnlyBlueprint';
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
import type {
	FdsOnKeyDownCallback,
	FdsStateMessageConnotation,
} from 'fontoxml-design-system/src/types';
import documentsHierarchy from 'fontoxml-documents/src/documentsHierarchy';
import documentsManager from 'fontoxml-documents/src/documentsManager';
import type { DocumentId, HierarchyNodeId } from 'fontoxml-documents/src/types';
import getNodeId from 'fontoxml-dom-identification/src/getNodeId';
import type { NodeId } from 'fontoxml-dom-identification/src/types';
import domInfo from 'fontoxml-dom-utils/src/domInfo';
import type { FontoNode } from 'fontoxml-dom-utils/src/types';
import FxNodePreview from 'fontoxml-fx/src/FxNodePreview';
import FxNodePreviewWithLinkSelector from 'fontoxml-fx/src/FxNodePreviewWithLinkSelector';
import FxVirtualForestCollapseButtons from 'fontoxml-fx/src/FxVirtualForestCollapseButtons';
import type { ModalProps } from 'fontoxml-fx/src/types';
import useDocumentLoader from 'fontoxml-fx/src/useDocumentLoader';
import useManagerState from 'fontoxml-fx/src/useManagerState';
import useOperation from 'fontoxml-fx/src/useOperation';
import t from 'fontoxml-localization/src/t';
import type { OperationName } from 'fontoxml-operations/src/types';
import evaluateXPathToBoolean from 'fontoxml-selectors/src/evaluateXPathToBoolean';
import type { XPathTest } from 'fontoxml-selectors/src/types';
import xq, { ensureXQExpression } from 'fontoxml-selectors/src/xq';
import getClosestStructureViewItem from 'fontoxml-structure/src/getClosestStructureViewItem';
import StructureView from 'fontoxml-structure/src/StructureView';

const INSTANCE_ID = 'structure-view-project-browser-modal-instance-id';

type CheckedItem = { hierarchyNodeId: HierarchyNodeId; contextNodeId: NodeId };

type IncomingModalData = {
	documentId: DocumentId;
	insertOperationName: OperationName;
	linkableElementsQuery?: string;
	modalIcon: string;
	modalPrimaryButtonLabel: string;
	modalTitle: string;
	nodeId: NodeId;
	selectedItems: CheckedItem[];
	showCheckboxSelector: XPathTest;
};
type SubmittedModalData =
	// if IncomingModalData.showCheckboxSelector === false
	| { documentId: DocumentId; nodeId: NodeId }
	// else if IncomingModalData.showCheckboxSelector === true
	| { selectedItems: CheckedItem[] };

const ProjectBrowserModal: FC<
	ModalProps<IncomingModalData, SubmittedModalData>
> = ({ cancelModal, data, submitModal }) => {
	const [nodeId, setNodeId] = useState(() => {
		if (data.nodeId) {
			return data.nodeId;
		}
		if (!data.documentId) {
			return undefined;
		}
		const documentNode = documentsManager.getDocumentNode(data.documentId);
		if (!documentNode) {
			return undefined;
		}
		const documentElement = blueprintQuery.findChild(
			readOnlyBlueprint,
			documentNode,
			domInfo.isElement
		);
		if (!documentElement) {
			return undefined;
		}
		return getNodeId(documentElement);
	});

	const [selectedStructureViewItem, setSelectedStructureViewItem] = useState(
		() => (nodeId ? getClosestStructureViewItem(nodeId) : null)
	);

	const handleStructureViewItemClick = useCallback<
		Exclude<ComponentProps<typeof StructureView>['onItemClick'], undefined>
	>((item) => {
		setSelectedStructureViewItem(item);
		// Clear the local derived state based on the previously selected/loaded
		// structure view item. This is no longer relevant.
		setNodeId(undefined);
	}, []);

	const { isLoading, documentId, error } = useDocumentLoader(
		null,
		null,
		selectedStructureViewItem?.hierarchyNodeId ?? null
	);

	// Reset the nodeId to the traversalRootNode after the
	// selectedStructureViewItem?.hierarchyNodeId changes and the corresponding
	// document is loaded (documentId from useDocumentLoader exists).
	useEffect(() => {
		if (
			!nodeId &&
			selectedStructureViewItem?.hierarchyNodeId &&
			documentId
		) {
			const rootNode: FontoNode | null =
				documentsHierarchy
					.get(selectedStructureViewItem?.hierarchyNodeId)
					?.documentReference?.getTraversalRootNode() ?? null;
			if (
				rootNode &&
				evaluateXPathToBoolean(
					xq`let $selectableNodes := ${ensureXQExpression(
						data.linkableElementsQuery ?? '//*[@id]'
					)} return some $node in $selectableNodes satisfies . is $node`,
					rootNode,
					readOnlyBlueprint
				)
			) {
				setNodeId(getNodeId(rootNode));
			}
		}
	}, [
		data.linkableElementsQuery,
		documentId,
		nodeId,
		selectedStructureViewItem?.hierarchyNodeId,
	]);

	const [checkedItems, setCheckedItems] = useState(data.selectedItems || []);

	const handleCheckboxClick = useCallback<
		Exclude<
			ComponentProps<typeof StructureView>['onItemCheckboxClick'],
			undefined
		>
	>(
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
					contextNodeId: node.contextNodeId,
					hierarchyNodeId: node.hierarchyNodeId,
				});
			} else {
				newCheckedItems.splice(checkedItemIndex, 1);
			}
			setCheckedItems(newCheckedItems);
			handleStructureViewItemClick(node);
		},
		[handleStructureViewItemClick, checkedItems]
	);

	const handlePreviewItemClick = useCallback<
		Exclude<
			ComponentProps<
				typeof FxNodePreviewWithLinkSelector
			>['onSelectedNodeChange'],
			undefined
		>
	>((nodeId) => {
		setNodeId(nodeId);
	}, []);

	const contextNodeIdByHierarchyNodeId = useManagerState(
		documentsHierarchy.hierarchyChangedNotifier,
		() => {
			const contextNodeIdByHierarchyNodeId = new Map<
				HierarchyNodeId,
				NodeId
			>();

			if (!data.showCheckboxSelector) {
				return contextNodeIdByHierarchyNodeId;
			}

			documentsHierarchy.find((hierarchyNode) => {
				const traversalRootNode =
					hierarchyNode.documentReference?.getTraversalRootNode();
				if (traversalRootNode) {
					const contextNode = domInfo.isDocument(traversalRootNode)
						? blueprintQuery.findChild(
								readOnlyBlueprint,
								traversalRootNode,
								domInfo.isElement
						  )
						: traversalRootNode;
					const contextNodeId = contextNode
						? getNodeId(contextNode)
						: undefined;
					if (contextNodeId) {
						contextNodeIdByHierarchyNodeId.set(
							hierarchyNode.getId(),
							contextNodeId
						);
					}
				}
				return false;
			});

			return contextNodeIdByHierarchyNodeId;
		}
	);

	const dataToSubmit = useMemo<SubmittedModalData | undefined>(() => {
		return data.showCheckboxSelector
			? {
					selectedItems: checkedItems.map((checkedItem) => {
						const contextNodeId =
							contextNodeIdByHierarchyNodeId.get(
								checkedItem.hierarchyNodeId
							);
						if (!checkedItem.contextNodeId && contextNodeId) {
							checkedItem.contextNodeId = contextNodeId;
						}

						return checkedItem;
					}),
			  }
			: documentId && nodeId
			? { documentId, nodeId }
			: undefined;
	}, [
		checkedItems,
		contextNodeIdByHierarchyNodeId,
		data.showCheckboxSelector,
		documentId,
		nodeId,
	]);

	const operationData = useMemo(
		() => ({ ...data, ...dataToSubmit }),
		[data, dataToSubmit]
	);

	const { operationState } = useOperation(
		data.insertOperationName,
		operationData
	);

	const isSubmitButtonDisabled = useMemo(
		() =>
			data.showCheckboxSelector
				? checkedItems.length === 0
				: !selectedStructureViewItem ||
				  !documentId ||
				  !nodeId ||
				  !operationState.enabled,
		[
			checkedItems.length,
			data.showCheckboxSelector,
			documentId,
			nodeId,
			operationState.enabled,
			selectedStructureViewItem,
		]
	);

	const handleKeyDownCancelOrSubmit = useCallback<FdsOnKeyDownCallback>(
		(event) => {
			switch (event.key) {
				case 'Escape':
					cancelModal();
					break;
				case 'Enter':
					if (!isSubmitButtonDisabled) {
						// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-non-null-assertion
						submitModal(dataToSubmit!);
					}
					break;
			}
		},
		[cancelModal, dataToSubmit, isSubmitButtonDisabled, submitModal]
	);

	const handleClearSelection = useCallback(() => {
		setCheckedItems([]);
	}, []);

	const handleSubmitButtonClick = useCallback(() => {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-non-null-assertion
		submitModal(dataToSubmit!);
	}, [dataToSubmit, submitModal]);

	const stateMessage = useMemo(() => {
		const stateMessage: {
			connotation: FdsStateMessageConnotation;
			message: string;
			title: string;
			visual: ReactNode;
		} = {
			connotation: 'muted',
			message: data.showCheckboxSelector
				? t(
						'Select an item to preview it and use the checkboxes to select items to insert.'
				  )
				: t('Select an item in the list to the left.'),
			title: t('No item selected'),
			visual: data.showCheckboxSelector
				? 'check-square'
				: 'hand-pointer-o',
		};

		if (isLoading) {
			stateMessage.connotation = 'muted';
			stateMessage.message = '';
			stateMessage.title = '';
			stateMessage.visual = <SpinnerIcon />;
		}

		if (error) {
			stateMessage.connotation = 'error';
			stateMessage.message = t(
				'Select a different item in the list to the left.'
			);
			stateMessage.title = t('This document could not be found');
			stateMessage.visual = 'fas fa-times';
		}

		return stateMessage;
	}, [data.showCheckboxSelector, error, isLoading]);

	return (
		<Modal isFullHeight size="l" onKeyDown={handleKeyDownCancelOrSubmit}>
			<ModalHeader icon={data.modalIcon} title={data.modalTitle || ''} />

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
						spaceSize="l"
					>
						<StructureView
							checkedItems={checkedItems}
							instanceId={INSTANCE_ID}
							onItemCheckboxClick={handleCheckboxClick}
							onItemClick={handleStructureViewItemClick}
							selectedContextNodeId={
								selectedStructureViewItem?.contextNodeId
							}
							selectedHierarchyNodeId={
								selectedStructureViewItem?.hierarchyNodeId
							}
							showCheckboxSelector={data.showCheckboxSelector}
							showNodeStatus
							showRemoteDocumentState
						/>
					</ModalContent>

					<ModalContent
						flex={data.showCheckboxSelector ? '3' : '2'}
						flexDirection="column"
						isScrollContainer
					>
						{!documentId || isLoading || error ? (
							<StateMessage
								connotation={stateMessage.connotation}
								message={stateMessage.message}
								paddingSize="m"
								title={stateMessage.title}
								visual={stateMessage.visual}
							/>
						) : data.showCheckboxSelector ? (
							<FxNodePreview
								documentId={documentId}
								traversalRootNodeId={
									selectedStructureViewItem?.contextNodeId
								}
							/>
						) : (
							<FxNodePreviewWithLinkSelector
								documentId={documentId}
								hierarchyNodeId={
									selectedStructureViewItem?.hierarchyNodeId
								}
								onSelectedNodeChange={handlePreviewItemClick}
								selector={
									data.linkableElementsQuery ?? '//*[@id]'
								}
								selectedNodeId={nodeId}
								traversalRootNodeId={
									selectedStructureViewItem?.contextNodeId
								}
							/>
						)}
					</ModalContent>
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
						isDisabled={isSubmitButtonDisabled}
						onClick={handleSubmitButtonClick}
					/>
				</Flex>
			</ModalFooter>
		</Modal>
	);
};

export default ProjectBrowserModal;
