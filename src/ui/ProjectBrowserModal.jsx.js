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
		selectedHierarchyNode: null,
		selectedNodeId: null,

		// Derived from the above by select
		insertOperationInitialData: {}
	};

	handleSubmitButtonClick = () => {
		this.props.submitModal({
			nodeId: this.state.selectedNodeId,
			documentId: this.state.selectedHierarchyNode.documentReference.documentId
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

	select(selectedHierarchyNode, selectedNodeId) {
		if (
			selectedHierarchyNode === this.state.selectedHierarchyNode &&
			selectedNodeId === this.state.selectedNodeId
		) {
			return;
		}
		this.setState({
			selectedHierarchyNode,
			selectedNodeId,
			insertOperationInitialData: {
				...this.props.data,
				nodeId: selectedNodeId,
				documentId:
					selectedHierarchyNode && selectedHierarchyNode.documentReference.documentId
			}
		});
	}

	isSelectableNode(nodeId) {
		return evaluateXPathToBoolean(
			'let $selectableNodes := ' +
				this.props.data.linkableElementsQuery +
				' return some $node in $selectableNodes satisfies . is $node',
			documentsManager.getNodeById(nodeId),
			readOnlyBlueprint
		);
	}

	handleStructureViewItemClick = item => {
		const hierarchyNode = documentsHierarchy.find(
			node => node.getId() === item.hierarchyNodeId
		);
		this.select(
			hierarchyNode,
			this.isSelectableNode(item.contextNodeId) ? item.contextNodeId : null
		);
	};

	handlePreviewItemClick = nodeId => {
		this.select(this.state.selectedHierarchyNode, nodeId);
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

					return (
						<Modal
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
											selectedContextNodeId={this.state.selectedNodeId}
											selectedHierarchyNodeId={
												this.state.selectedHierarchyNode &&
												this.state.selectedHierarchyNode.getId()
											}
										/>
									</ModalContent>

									{!this.state.selectedHierarchyNode ? (
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
											flex="2"
											flexDirection="column"
											isScrollContainer
										>
											<FxNodePreviewWithLinkSelector
												documentId={
													this.state.selectedHierarchyNode
														.documentReference.documentId
												}
												onSelectedNodeChange={this.handlePreviewItemClick}
												selector={linkableElementsQuery}
												selectedNodeId={this.state.selectedNodeId}
												traversalRootNodeId={
													this.state.selectedHierarchyNode
														.documentReference.traversalRootNodeId
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
		if (nodeId && this.isSelectableNode(nodeId)) {
			const selectedNode = documentsManager.getNodeById(nodeId);
			const closest = documentsHierarchy
				.findAll(node => {
					// Ignore hierarchy nodes without a loaded document
					if (!node.documentReference || !node.documentReference.documentId) {
						return false;
					}

					return node.documentReference.getTraversalRootNode().contains(selectedNode);
				})
				.map(node => ({ node, root: node.documentReference.getTraversalRootNode() }))
				.reduce(
					(closest, node) =>
						!closest || closest.root.contains(node.root) ? node : closest,
					null
				);
			if (closest) {
				this.select(closest.node, nodeId);
			}
		}
	}
}

export default ProjectBrowserModal;
