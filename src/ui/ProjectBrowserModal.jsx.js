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
import readOnlyBlueprint from 'fontoxml-blueprints/readOnlyBlueprint';
import documentsHierarchy from 'fontoxml-documents/documentsHierarchy';
import documentsManager from 'fontoxml-documents/documentsManager';
import evaluateXPathToBoolean from 'fontoxml-selectors/evaluateXPathToBoolean';
import FxNodePreviewWithLinkSelector from 'fontoxml-fx/FxNodePreviewWithLinkSelector.jsx';
import FxOperation from 'fontoxml-fx/FxOperation.jsx';
import getClosestStructureViewItem from 'fontoxml-structure-view/getClosestStructureViewItem';
import StructureView from 'fontoxml-structure-view/StructureView.jsx';
import t from 'fontoxml-localization/t';

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

	select(currentHierarchyNode, currentTraversalRootNodeId, selectedNodeId) {
		if (
			currentHierarchyNode === this.state.currentHierarchyNode &&
			currentTraversalRootNodeId === this.state.currentTraversalRootNodeId &&
			selectedNodeId === this.state.selectedNodeId
		) {
			return;
		}
		this.setState({
			currentHierarchyNode,
			currentTraversalRootNodeId,
			selectedNodeId,
			insertOperationInitialData: {
				...this.props.data,
				nodeId: selectedNodeId,
				documentId:
					currentHierarchyNode && currentHierarchyNode.documentReference.documentId
			}
		});
	}

	isSelectableNode(nodeId) {
		return (
			!!nodeId &&
			evaluateXPathToBoolean(
				'let $selectableNodes := ' +
					this.props.data.linkableElementsQuery +
					' return some $node in $selectableNodes satisfies . is $node',
				documentsManager.getNodeById(nodeId),
				readOnlyBlueprint
			)
		);
	}

	handleStructureViewItemClick = item => {
		const hierarchyNode = documentsHierarchy.find(
			node => node.getId() === item.hierarchyNodeId && !!node.documentReference
		);
		this.select(
			hierarchyNode,
			item.contextNodeId,
			this.isSelectableNode(item.contextNodeId) ? item.contextNodeId : null
		);
	};

	handlePreviewItemClick = nodeId => {
		this.select(this.state.currentHierarchyNode, this.state.currentTraversalRootNodeId, nodeId);
	};

	render() {
		const {
			cancelModal,
			data: {
				insertOperationName,
				linkableElementsQuery,
				modalIcon,
				modalPrimaryButtonLabel,
				modalTitle
			}
		} = this.props;

		const hasCompleteSelection = !!this.state.selectedNodeId;

		// Wrap the entire modal in an FxOperation so we can handle keydown based on the resulting state
		return (
			<FxOperation
				operationName={(hasCompleteSelection && insertOperationName) || 'do-nothing'}
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
							size="m"
							onKeyDown={
								canSubmit ? (
									this.handleKeyDownCancelOrSubmit
								) : (
									this.handleKeyDownCancelOnly
								)
							}
						>
							<ModalHeader icon={modalIcon} title={modalTitle} />

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

									{!selectedDocumentId ? (
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
									) : (
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
												selector={linkableElementsQuery}
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
								<Button label={t('Cancel')} onClick={cancelModal} />

								<Button
									type="primary"
									label={modalPrimaryButtonLabel}
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
			this.isSelectableNode(nodeId) ? nodeId : null
		);
	}
}

export default ProjectBrowserModal;
