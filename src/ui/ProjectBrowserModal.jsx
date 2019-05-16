import PropTypes from 'prop-types';
import React, { Component } from 'react';

import {
	Button,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	StateMessage
} from 'fds/components';
import readOnlyBlueprint from 'fontoxml-blueprints/src/readOnlyBlueprint.js';
import documentsHierarchy from 'fontoxml-documents/src/documentsHierarchy.js';
import documentsManager from 'fontoxml-documents/src/documentsManager.js';
import evaluateXPathToBoolean from 'fontoxml-selectors/src/evaluateXPathToBoolean.js';
import FxNodePreviewWithLinkSelector from 'fontoxml-fx/src/FxNodePreviewWithLinkSelector.jsx';
import FxOperation from 'fontoxml-fx/src/FxOperation.jsx';
import getClosestStructureViewItem from 'fontoxml-structure-view/src/getClosestStructureViewItem.js';
import StructureView from 'fontoxml-structure-view/src/StructureView.jsx';
import initialDocumentsManager from 'fontoxml-remote-documents/src/initialDocumentsManager.js';
import t from 'fontoxml-localization/src/t.js';

function isSelectableNode(linkableElementsQuery, nodeId) {
	return (
		!!nodeId &&
		evaluateXPathToBoolean(
			'let $selectableNodes := ' +
				linkableElementsQuery +
				' return some $node in $selectableNodes satisfies . is $node',
			documentsManager.getNodeById(nodeId),
			readOnlyBlueprint
		)
	);
}

class ProjectBrowserModal extends Component {
	static propTypes = {
		cancelModal: PropTypes.func.isRequired,
		data: PropTypes.shape({
			documentId: PropTypes.string,
			insertOperationName: PropTypes.string,
			linkableElementsQuery: PropTypes.string.isRequired,
			modalIcon: PropTypes.string,
			modalPrimaryButtonLabel: PropTypes.string.isRequired,
			modalTitle: PropTypes.string.isRequired,
			nodeId: PropTypes.string
		}),
		submitModal: PropTypes.func.isRequired
	};

	state = {
		// Selected hierarchy node and node ID from the structure view
		currentHierarchyNode: null,
		currentTraversalRootNodeId: null,

		// Selected node ID from the preview
		selectedNodeId: null,

		// Derived from the above by select
		insertOperationInitialData: {}
	};

	handleSubmitButtonClick = () => {
		this.props.submitModal({
			nodeId: this.state.selectedNodeId,
			documentId: this.state.currentHierarchyNode.documentReference.documentId
		});
	};

	handleKeyDownCancelOrSubmit = event => {
		switch (event.key) {
			case 'Escape':
				this.props.cancelModal();
				break;
			case 'Enter':
				this.handleSubmitButtonClick();
				break;
		}
	};

	handleKeyDownCancelOnly = event => {
		switch (event.key) {
			case 'Escape':
				this.props.cancelModal();
				break;
		}
	};

	select(hierarchyNode, traversalRootNodeId, nodeId) {
		this.setState(({ currentHierarchyNode, currentTraversalRootNodeId, selectedNodeId }) => {
			if (
				hierarchyNode === currentHierarchyNode &&
				traversalRootNodeId === currentTraversalRootNodeId &&
				nodeId === selectedNodeId
			) {
				return null;
			}

			return {
				currentHierarchyNode: hierarchyNode,
				currentTraversalRootNodeId: traversalRootNodeId,
				selectedNodeId: nodeId,
				insertOperationInitialData: {
					...this.props.data,
					nodeId,
					documentId: hierarchyNode && hierarchyNode.documentReference.documentId
				}
			};
		});
	}

	handleStructureViewItemClick = item => {
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
				this.select(
					hierarchyNode,
					item.contextNodeId,
					isSelectableNode(this.props.data.linkableElementsQuery, item.contextNodeId)
						? item.contextNodeId
						: null
				)
			);
			return;
		}

		this.select(
			hierarchyNode,
			item.contextNodeId,
			isSelectableNode(this.props.data.linkableElementsQuery, item.contextNodeId)
				? item.contextNodeId
				: null
		);
	};

	handlePreviewItemClick = nodeId => {
		this.select(this.state.currentHierarchyNode, this.state.currentTraversalRootNodeId, nodeId);
	};

	render() {
		const hasCompleteSelection = !!this.state.selectedNodeId;
		const operationName =
			(hasCompleteSelection && this.props.data.insertOperationName) || 'do-nothing';

		// Wrap the entire modal in an FxOperation so we can handle keydown based on the resulting state
		return (
			<FxOperation
				operationName={operationName}
				initialData={this.state.insertOperationInitialData}
			>
				{({ operationState }) => {
					const canSubmit = hasCompleteSelection && operationState.enabled;
					const selectedDocumentId = this.state.currentHierarchyNode
						? this.state.currentHierarchyNode.documentReference.documentId
						: null;

					return (
						<Modal
							isFullHeight
							size="l"
							onKeyDown={
								canSubmit
									? this.handleKeyDownCancelOrSubmit
									: this.handleKeyDownCancelOnly
							}
						>
							<ModalHeader
								icon={this.props.data.modalIcon}
								title={this.props.data.modalTitle}
							/>

							<ModalBody>
								<ModalContent>
									<ModalContent flexDirection="column" isScrollContainer>
										<StructureView
											onItemClick={this.handleStructureViewItemClick}
											selectedContextNodeId={
												this.state.currentTraversalRootNodeId
											}
											selectedHierarchyNodeId={
												this.state.currentHierarchyNode &&
												this.state.currentHierarchyNode.getId()
											}
										/>
									</ModalContent>

									{!selectedDocumentId && (
										<ModalContent flexDirection="column">
											<StateMessage
												message={t(
													'Select an item in the list to the left.'
												)}
												paddingSize="m"
												title={t('No item selected')}
												visual="hand-pointer-o"
											/>
										</ModalContent>
									)}
									{selectedDocumentId && (
										<ModalContent
											key={
												selectedDocumentId +
												this.state.currentTraversalRootNodeId
											}
											flex="2"
											flexDirection="column"
											isScrollContainer
										>
											<FxNodePreviewWithLinkSelector
												documentId={selectedDocumentId}
												onSelectedNodeChange={this.handlePreviewItemClick}
												selector={this.props.data.linkableElementsQuery}
												selectedNodeId={this.state.selectedNodeId}
												traversalRootNodeId={
													this.state.currentTraversalRootNodeId
												}
											/>
										</ModalContent>
									)}
								</ModalContent>
							</ModalBody>

							<ModalFooter>
								<Button label={t('Cancel')} onClick={this.props.cancelModal} />

								<Button
									type="primary"
									label={this.props.data.modalPrimaryButtonLabel}
									isDisabled={!canSubmit}
									onClick={this.handleSubmitButtonClick}
								/>
							</ModalFooter>
						</Modal>
					);
				}}
			</FxOperation>
		);
	}

	componentDidMount() {
		// Determine initial selection based on the given nodeId
		const { nodeId } = this.props.data;
		if (!nodeId) {
			return;
		}

		const closestItem = getClosestStructureViewItem(nodeId);
		if (!closestItem) {
			return;
		}

		var hierarchyNode = documentsHierarchy.find(node => {
			return node.getId() === closestItem.hierarchyNodeId;
		});

		this.select(
			hierarchyNode,
			closestItem.contextNodeId,
			isSelectableNode(this.props.data.linkableElementsQuery, nodeId) ? nodeId : null
		);
	}
}

export default ProjectBrowserModal;
