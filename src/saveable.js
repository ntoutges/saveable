import * as objUtils from "./objUtils.js";
import { ObjRepo } from "./objRepo.js";
export class Saveable {
    initParams = new Map();
    initParamGetters = new Map();
    initParamObjectifications = new Map();
    objectRepository = new ObjRepo();
    dependencies = new Set();
    addInitParams(params, delParams = null) {
        if (delParams !== null)
            this.delInitParams(delParams);
        for (const key in params) {
            this.initParams.set(key, params[key]);
        }
    }
    delInitParams(params) {
        if (params === "*")
            params = Array.from(this.initParams.keys()); // remove all params
        for (const key of params) {
            this.initParams.delete(key);
        }
    }
    addInitParamGetter(params, delParams = null) {
        if (delParams != null)
            this.delInitParamGetter(delParams);
        for (const key in params)
            this.initParamGetters.set(key, params[key]);
    }
    delInitParamGetter(params) {
        if (params === "*")
            params = Array.from(this.initParams.keys()); // remove all params
        for (const key of params) {
            this.initParams.delete(key);
        }
    }
    /**
     * Define which init params will be treated as objects
     * @param keys key gives path to initParam, value gives type (ex: widget)
     */
    defineObjectificationInitParams(keys) { Object.keys(keys).forEach(key => this.initParamObjectifications.set(key, keys[key])); }
    /**
     * Define which init params will be treated as objects
     * @param keys array of keys, with subkeys separated by "."
     */
    undefineObjectificationInitParams(keys) { keys.forEach(key => this.initParamObjectifications.delete(key)); }
    addDependency(id) { if (id !== null)
        this.dependencies.add(id); }
    removeDependency(id) { this.dependencies.delete(id); }
    setDependencies(...ids) {
        for (const id of this.dependencies) {
            this.removeDependency(id);
        } // remove all
        for (const id of ids) {
            this.addDependency(id);
        } // add all
    }
    getDependencies() { return Array.from(this.dependencies); }
    save() {
        return {
            params: Saveable.save(Array.from(this.initParams).reduce((acc, [key, value]) => { acc[key] = value; return acc; }, Array.from(this.initParamGetters).reduce((acc, [key, getter]) => { acc[key] = getter(); return acc; }, {})), Array.from(this.initParamObjectifications).reduce((acc, [key, value]) => { acc[key] = value; return acc; }, {}))
        };
    }
    static save(obj, objectifications) {
        obj = Saveable.deepCopyBaseObject(obj); // make copy of object so as not to modify original
        const usedInstances = new Map();
        for (const objectification in objectifications) {
            const segments = objUtils.smartSplit(objUtils.smartSplit(objectification, ".", { "\"": "\"" }), "*");
            if (Array.isArray(segments[0]) && segments[0].length == 0)
                segments.shift(); // empty selector, remove it
            let roots = [obj];
            for (const i in segments) { // get all but last segment
                const segment = segments[i];
                const isLast = +i == segments.length - 1;
                roots = roots.map(root => objUtils.getSubObject(root, isLast ? segment.slice(0, -1) : segment, null)).filter(root => root !== null);
                if (roots == null)
                    continue;
                if (!isLast)
                    roots = roots.map(root => Object.keys(root).map(key => root[key])).flat(1); // add all items
            }
            const type = objectifications[objectification];
            const lastSegment = segments[segments.length - 1];
            if (lastSegment.length > 0) {
                const lastKey = lastSegment[lastSegment.length - 1];
                roots.forEach(root => {
                    if (!root.hasOwnProperty(lastKey) || root[lastKey] == null)
                        return;
                    if (typeof root[lastKey] == "function")
                        root[lastKey] = { "$$C": { name: root[lastKey].name, type } }; // class
                    else if (typeof root[lastKey] == "object")
                        root[lastKey] = { "$$I": { name: root[lastKey].constructor.name, type } }; // instance
                });
            }
            else {
                roots.forEach(root => {
                    for (const lastKey in root)
                        this.buildSavedObject(root, lastKey, type, usedInstances);
                });
            }
        }
        return obj;
    }
    // makes a deep copy of record objects, but ignores other objects (obj.constructor.name == "Object")
    static deepCopyBaseObject(obj) {
        const copy = {};
        for (const key in obj) {
            copy[key] = Saveable.isBaseObject(obj[key]) ? Saveable.deepCopyBaseObject(obj[key]) : obj[key];
        }
        return copy;
    }
    static isBaseObject(object) {
        return object && typeof object == "object" && (object.constructor.name == "Object" || Array.isArray(object));
    }
    static buildSavedObject(root, lastKey, type, usedInstances = null) {
        const name = root[lastKey].constructor.name;
        // keeps track of which instance to use
        let group = (usedInstances == null) ? 0 : 1; // group 0 is the nogroup: new instance for every element in that group
        // fill in usedInstances/update groupId
        if (usedInstances) {
            if (!usedInstances.has(type))
                usedInstances.set(type, new Map());
            if (!usedInstances.get(type).has(name))
                usedInstances.get(type).set(name, new Map());
            group = (usedInstances.get(type).get(name).get(root[lastKey]) ?? 0) + 1; // set group
            usedInstances.get(type).get(name).set(root[lastKey], group); // update usedInstances
        }
        if (typeof root[lastKey] == "function")
            root[lastKey] = { "$$C": { name: root[lastKey].name, type } }; // class
        else if (typeof root[lastKey] == "object") { // instance
            const object = {
                name,
                type,
                group,
                data: root[lastKey]?.save() ?? null,
                dependencies: root[lastKey]?.getDependencies() ?? null
            };
            if (object.data === null)
                delete object.data;
            if (object.dependencies === null || !object.dependencies.length)
                delete object.dependencies;
            root[lastKey] = { "$$I": object };
            ;
        }
    }
    static getUnobjectifiedDependencies(object) {
        if (object["$$I"] && typeof object["$$I"] === "object")
            return Saveable.getUnobjectifiedDependencies(object["$$I"]); // get from instance data
        return (object.dependencies && typeof object.dependencies === "object" && Array.isArray(object.dependencies)) ? object.dependencies : []; // given data directly
    }
    objectify(state, preloadRoot = null, root = state) {
        const queue = Object.keys(state).filter(key => typeof state[key] == "object" && state[key] !== null).map(key => [state, key, Object.keys(state[key])]);
        while (queue.length > 0) {
            const [obj, lastKey, nextKeys] = queue[queue.length - 1];
            const lastObj = obj[lastKey];
            if (nextKeys.length == 0) { // queue empty: objectify
                for (const key in lastObj) {
                    const objectified = this._objectify(key, lastObj[key], obj == root ? preloadRoot : null);
                    if (objectified !== null)
                        obj[lastKey] = objectified;
                }
                queue.pop(); // get rid of (possibly) objectified element
                continue;
            }
            const nextKey = nextKeys.pop();
            const nextObj = lastObj[nextKey];
            // 'nextObj' is a valid itterable object
            if (typeof nextObj == "object" && nextObj !== null) {
                queue.push([lastObj, nextKey, Object.keys(nextObj)]);
            }
        }
        return state;
    }
    _objectify(key, obj, preload = null) {
        if (key.length < 3 || key.substring(0, 2) != "$$")
            return null; // cannot be objectified
        const loadClass = this.objectRepository.getObject(obj.type, obj.name);
        if (loadClass == null) {
            console.error(`Unable to find load class ${obj.type}.${obj.name}`);
            return null;
        }
        switch (key[2]) {
            case "C": // (C)onstructor
                return loadClass.classname;
            case "I": { // (I)instance
                const instance = new loadClass.classname(obj.data.params);
                if (preload)
                    preload(instance, obj.data);
                instance?.load(obj.data);
                return instance;
            }
        }
        return null;
    }
}
//# sourceMappingURL=saveable.js.map