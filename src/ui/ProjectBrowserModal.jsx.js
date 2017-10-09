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
import documentsManager from 'fontoxml-documents/documentsManager';
import evaluateXPathToBoolean from 'fontoxml-selectors/evaluateXPathToBoolean';
import FxNodePreviewWithLinkSelector from 'fontoxml-fx/FxNodePreviewWithLinkSelector.jsx';
import structureViewManager from 'fontoxml-structure-view/structureViewManager';
import t from 'fontoxml-localization/t';

import ProjectHierarchyList from './ProjectHierarchyList.jsx';

function determineSelectedHierarchyNode(hierarchyNode, selectedAncestors, nodeToSearchFor) {
	let isSelected = false;
	for (const childHierarchyNode of hierarchyNode.children) {
		if (
			determineSelectedHierarchyNode(childHierarchyNode, selectedAncestors, nodeToSearchFor)
		) {
			isSelected = true;
		}
	}
	if (isSelected) {
		// We are indirectly selected, no need to search here
		selectedAncestors.push(hierarchyNode.contextNodeId);
		return true;
	}

	// See if the focus lies here
	const contextNodeId = hierarchyNode.contextNodeId;
	const hierarchyDomNode = documentsManager.getNodeById(contextNodeId);
	isSelected = hierarchyDomNode.contains(nodeToSearchFor);
	if (isSelected) {
		selectedAncestors.push(hierarchyNode.contextNodeId);
	}
	return isSelected;
}

class ProjectBrowserModal extends Component {
	static propTypes = {
		cancelModal: PropTypes.func.isRequired,
		data: PropTypes.shape({
			documentId: PropTypes.string,
			linkableElementsQuery: PropTypes.string.isRequired,
			modalIcon: PropTypes.string,
			modalPrimaryButtonLabel: PropTypes.string.isRequired,
			modalTitle: PropTypes.string.isRequired,
			nodeId: PropTypes.string
		}),
		submitModal: PropTypes.func.isRequired
	};

	hierarchyNodes = structureViewManager.getStructureViewForest();

	state = {
		selectedAncestors: [],
		selectedNode: null
	};

	handleSubmit = selectedNode =>
		this.props.submitModal({
			nodeId: selectedNode.nodeId,
			documentId: selectedNode.documentId
		});

	handleKeyDown = event => {
		const { selectedNode } = this.state;
		switch (event.key) {
			case 'Escape':
				this.props.cancelModal();
				break;
			case 'Enter':
				if (selectedNode && selectedNode.nodeId) {
					this.handleSubmit(selectedNode);
				}
				break;
		}
	};

	handleHierarchyListItemClick = hierarchyNode => {
		const selectedHierarchyNodes = [];
		const rootNode = documentsManager.getNodeById(hierarchyNode.contextNodeId);

		this.hierarchyNodes.find(hierarchyNode =>
			determineSelectedHierarchyNode(hierarchyNode, selectedHierarchyNodes, rootNode)
		);

		if (selectedHierarchyNodes.length === 0) {
			return;
		}

		const newState = {
			selectedAncestors: selectedHierarchyNodes,
			selectedNode: {
				documentId: documentsManager.getDocumentIdByNodeId(hierarchyNode.contextNodeId),
				rootNodeId: hierarchyNode.contextNodeId
			}
		};

		if (
			evaluateXPathToBoolean(
				'let $selectableNodes := ' +
					this.props.data.linkableElementsQuery +
					' return some $node in $selectableNodes satisfies . is $node',
				rootNode,
				readOnlyBlueprint
			)
		) {
			newState.selectedNode = {
				...newState.selectedNode,
				nodeId: hierarchyNode.contextNodeId
			};
		}

		this.setState(newState);
	};

	handlePreviewItemClick = nodeId =>
		this.setState(({ selectedNode: prevSelectedNode }) => ({
			selectedNode: { ...prevSelectedNode, nodeId: nodeId }
		}));

	handleSubmitButtonClick = () => this.handleSubmit(this.state.selectedNode);

	render() {
		const { selectedAncestors, selectedNode } = this.state;
		const {
			cancelModal,
			data: { linkableElementsQuery, modalIcon, modalPrimaryButtonLabel, modalTitle }
		} = this.props;

		return (
			<Modal size="m" onKeyDown={this.handleKeyDown}>
				<ModalHeader icon={modalIcon} title={modalTitle} />

				<ModalBody>
					<ModalContent>
						<ModalContent flexDirection="column" isScrollContainer paddingSize="m">
							<ProjectHierarchyList
								rootNodes={this.hierarchyNodes}
								onItemClick={this.handleHierarchyListItemClick}
								selectedAncestors={selectedAncestors}
								selectedNode={selectedNode}
							/>
						</ModalContent>

						{!selectedNode && (
							<ModalContent flexDirection="column">
								<StateMessage
									message={t('Select an item in the list to the left.')}
									paddingSize="m"
									title={t('No item selected')}
									visual="hand-pointer-o"
								/>
							</ModalContent>
						)}

						{selectedNode && (
							<ModalContent flex="2" flexDirection="column" isScrollContainer>
								<FxNodePreviewWithLinkSelector
									documentId={selectedNode.documentId}
									onSelectedNodeChange={this.handlePreviewItemClick}
									selector={linkableElementsQuery}
									selectedNodeId={selectedNode.nodeId}
									traversalRootNodeId={selectedNode.rootNodeId}
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
						isDisabled={!selectedNode || !selectedNode.nodeId}
						onClick={this.handleSubmitButtonClick}
					/>
				</ModalFooter>
			</Modal>
		);
	}

	componentDidMount() {
		const { documentId, nodeId } = this.props.data;

		if (nodeId) {
			const selectedHierarchyNodes = [];
			const selectedNode = documentsManager.getNodeById(nodeId);

			this.hierarchyNodes.find(hierarchyNode =>
				determineSelectedHierarchyNode(hierarchyNode, selectedHierarchyNodes, selectedNode)
			);

			if (selectedHierarchyNodes.length === 0) {
				return;
			}

			this.setState({
				selectedAncestors: selectedHierarchyNodes,
				selectedNode: {
					documentId: documentId || documentsManager.getDocumentIdByNodeId(nodeId),
					rootNodeId: selectedHierarchyNodes[0],
					nodeId: nodeId
				}
			});
		}
	}
}

export default ProjectBrowserModal;
