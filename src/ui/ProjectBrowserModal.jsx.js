import PropTypes from 'prop-types';
import React, { Component } from 'react';

import documentsManager from 'fontoxml-documents/documentsManager';
import NodePreviewWithLinkSelector from 'fontoxml-fx/NodePreviewWithLinkSelector.jsx';
import structureViewManager from 'fontoxml-structure-view/structureViewManager';
import t from 'fontoxml-localization/t';

import {
	Button,
	Modal,
	ModalBody,
	ModalContent,
	ModalFooter,
	ModalHeader,
	StateMessage
} from 'fontoxml-vendor-fds/components';

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

	determineNewState = (nodeId, documentId) => {
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
	};

	handleHierarchyListItemClick = hierarchyNode => {
		this.determineNewState(hierarchyNode.contextNodeId, null);
	};

	handlePreviewItemClick = nodeId =>
		this.setState(({ selectedNode: prevSelectedNode }) => ({
			selectedNode: { ...prevSelectedNode, nodeId: nodeId }
		}));

	handleSubmitButtonClick = () => {
		const { selectedNode } = this.state;
		this.props.submitModal({
			nodeId: selectedNode.nodeId,
			documentId: selectedNode.documentId
		});
	};

	render() {
		const { selectedAncestors, selectedNode } = this.state;
		const {
			cancelModal,
			data: { linkableElementsQuery, modalPrimaryButtonLabel, modalTitle }
		} = this.props;

		return (
			<Modal size="m">
				<ModalHeader title={modalTitle} />

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
								<NodePreviewWithLinkSelector
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
						isDisabled={!selectedNode}
						onClick={this.handleSubmitButtonClick}
					/>
				</ModalFooter>
			</Modal>
		);
	}

	componentDidMount() {
		const { documentId, nodeId } = this.props.data;

		if (nodeId) {
			this.determineNewState(nodeId, documentId);
		}
	}
}

export default ProjectBrowserModal;
