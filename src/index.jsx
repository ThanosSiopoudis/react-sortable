import React from 'react';
import ReactDOM from 'react-dom';
import Sortable from 'sortablejs';

const defaultOptions = {
    ref: 'list',
    model: 'items',
    onStart: 'handleStart',
    onEnd: 'handleEnd',
    onAdd: 'handleAdd',
    onUpdate: 'handleUpdate',
    onRemove: 'handleRemove',
    onSort: 'handleSort',
    onFilter: 'handleFilter',
    onMove: 'handleMove'
};

let _nextSibling = null;
let _activeWrapperComponent = null;

const refName = 'sortableComponent';

const getModelItems = (wrapperComponent) => {
    const model = wrapperComponent.sortableOptions.model;
    const sortableComponent = wrapperComponent.refs[refName];
    const { state = {}, props = {} } = sortableComponent;
    const items = state[model] || props[model] || [];
    return items.slice(); // returns a shallow copy of the items array
};

const extend = (target, ...sources) => {
    sources.forEach((source) => {
        for (let key in source) {
            if (source.hasOwnProperty(key)) {
                target[key] = source[key];
            }
        }
    });

    return target;
};

const SortableMixin = (options = defaultOptions) => (Component) => class extends React.Component {

    state = {
        sortableInstance: null
    };

    sortableOptions = extend({}, defaultOptions, options);

    componentDidMount() {
        const sortableComponent = this.refs[refName];
        const emitEvent = (type, evt) => {
            const methodName = this.sortableOptions[type];
            const method = sortableComponent[methodName];
            method && method.call(sortableComponent, evt, this.state.sortableInstance);
        };

        let copyOptions = extend({}, this.sortableOptions);

        [ // Bind callbacks
            'onStart',
            'onEnd',
            'onAdd',
            'onSort',
            'onUpdate',
            'onRemove',
            'onFilter',
            'onMove'
        ].forEach((name) => {
            copyOptions[name] = (evt) => {
                if (name === 'onStart') {
                    _nextSibling = evt.item.nextElementSibling;
                    _activeWrapperComponent = this;
                } else if (name === 'onAdd' || name === 'onUpdate') {
                    evt.from.insertBefore(evt.item, _nextSibling);

                    // Subtract x amount of elements
                    // because of our page break
                    // How many?
                    var amtToSubOld = evt.oldIndex > 60 ? Math.floor(evt.oldIndex / 60) : 0;
                    var amtToSubNew = evt.newIndex > 60 ? Math.floor(evt.oldIndex / 60) : 0;

                    const oldIndex = evt.oldIndex - amtToSubOld;
                    const newIndex = evt.newIndex - amtToSubNew;
                    let newState = {};
                    let remoteState = {};
                    let items = getModelItems(this);

                    if (name === 'onAdd') {
                        let remoteItems = getModelItems(_activeWrapperComponent);
                        let item = remoteItems.splice(oldIndex, 1)[0];
                        items.splice(newIndex, 0, item);

                        remoteState[_activeWrapperComponent.sortableOptions.model] = remoteItems;
                    } else {
                        items.splice(newIndex, 0, items.splice(oldIndex, 1)[0]);
                    }

                    newState[this.sortableOptions.model] = items;

                    if (copyOptions.stateHandler) {
                        sortableComponent[copyOptions.stateHandler](newState);
                    } else {
                        sortableComponent.setState(newState);
                    }

                    if (_activeWrapperComponent !== this) {
                        _activeWrapperComponent.refs[refName].setState(remoteState);
                    }
                }

                setTimeout(() => {
                    emitEvent(name, evt);
                }, 0);
            };
        });
        this.populatedOptions = copyOptions
        this.initSortable(sortableComponent);
    }
    componentWillReceiveProps(nextProps) {
        const sortableComponent = this.refs[refName];
        const model = this.sortableOptions.model;
        const items = nextProps[model];

        if (items) {
            let newState = {};
            newState[model] = items;
            sortableComponent.setState(newState);
        }
    }
    componentDidUpdate(prevProps) {
        const model = this.sortableOptions.model;
        const prevItems = prevProps[model];
        const currItems = this.props[model];
        if(prevItems !== currItems) {
            this.initSortable(this.refs[refName]);
        }
    }
    componentWillUnmount() {
        this.destroySortable();
    }
    initSortable(sortableComponent) {
        this.destroySortable();
        const domNode = ReactDOM.findDOMNode(sortableComponent.refs[this.sortableOptions.ref] || sortableComponent);
        const sortableInstance = Sortable.create(domNode, this.populatedOptions);
        this.setState({sortableInstance});
    }
    destroySortable() {
        if (this.state.sortableInstance) {
            this.state.sortableInstance.destroy();
            this.setState({sortableInstance: null});
        }
    }

    render() {
        return (
            <Component ref={refName} {...this.props} {...this.state} />
        );
    }
};

export default SortableMixin;
