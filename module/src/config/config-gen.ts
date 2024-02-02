// To parse this data:
//
//   import { Convert, ConfigGen } from "./file";
//
//   const configGen = Convert.toConfigGen(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface ConfigGen {
    /**
     * Additional bridge configuration
     */
    bridge: Bridge;
    /**
     * Default settings to apply to lights and scenes
     */
    defaults: Defaults;
    /**
     * A list of dimmer switches
     */
    "dimmer-switches"?: DimmerSwitch[];
    /**
     * A list of lights and smart plugs
     */
    lights: Light[];
    /**
     * A list of motion sensors
     */
    "motion-sensors"?: MotionSensor[];
    /**
     * A name for this config
     */
    name?: string;
    /**
     * A list of rooms
     */
    rooms: Room[];
    /**
     * A list of tap dial switches
     */
    "tap-dial-switches"?: TapDialSwitch[];
    /**
     * A list of wall switches
     */
    "wall-switches"?: WallSwitch[];
    /**
     * A list of zones
     */
    zones?: Zone[];
}

/**
 * Additional bridge configuration
 */
export interface Bridge {
    /**
     * The bridge latitude
     */
    lat: string;
    /**
     * The bridge longitude
     */
    long: string;
}

/**
 * Default settings to apply to lights and scenes
 */
export interface Defaults {
    /**
     * What lights should do when powered on by a classic light switch or after a power outage.
     * "last_on_state": last-used color and brightness. "safety": warm white, full brightness.
     * "powerfail": stays off or turn back on.
     */
    "powerup-behavior": PowerupBehavior;
    /**
     * Default scenes for room and zones
     */
    scenes: Scenes;
}

/**
 * What lights should do when powered on by a classic light switch or after a power outage.
 * "last_on_state": last-used color and brightness. "safety": warm white, full brightness.
 * "powerfail": stays off or turn back on.
 */
export enum PowerupBehavior {
    LastOnState = "last_on_state",
    Powerfail = "powerfail",
    Safety = "safety",
}

/**
 * Default scenes for room and zones
 */
export interface Scenes {
    day:                    Scene;
    "motion-sensor-day"?:   Scene;
    "motion-sensor-night"?: Scene;
    night:                  Scene;
}

export interface Scene {
    /**
     * A default brightness percentage for lights
     */
    brigthness:          number;
    "color-temperature": ColorTemperature;
    /**
     * The ID of a 'public_image' resource for the scene
     */
    "image-id": string;
    /**
     * A name for the scene
     */
    name: string;
    [property: string]: any;
}

/**
 * A default color temperature for lights
 */
export interface ColorTemperature {
    /**
     * A color temperature in mirek
     */
    mirek: number;
}

export interface DimmerSwitch {
    /**
     * Configuration for the first dimmer switch button
     */
    button1: DimmerSwitchButton1;
    /**
     * Configuration for the second dimmer switch button
     */
    button2: DimmerSwitchButton2;
    /**
     * Configuration for the third dimmer switch button
     */
    button3: DimmerSwitchButton3;
    /**
     * Configuration for the forth dimmer switch button
     */
    button4:  DimmerSwitchButton4;
    comment?: string;
    /**
     * Uniquely identify the dimmer switch in this configuration
     */
    id: string;
    /**
     * MAC address, required for uniquely identifying dimmer switches added to a bridge
     */
    mac: string;
    /**
     * A name for the dimmer switch
     */
    name: string;
    /**
     * Serial number printed on the dimmer switch, recommended for searching for missing dimmer
     * switches
     */
    serial?: string;
}

/**
 * Configuration for the first dimmer switch button
 */
export interface DimmerSwitchButton1 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

/**
 * Configuration for the second dimmer switch button
 */
export interface DimmerSwitchButton2 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

/**
 * Configuration for the third dimmer switch button
 */
export interface DimmerSwitchButton3 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

/**
 * Configuration for the forth dimmer switch button
 */
export interface DimmerSwitchButton4 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

export interface Light {
    comment?: string;
    /**
     * Uniquely identify the light in this configuration
     */
    id: string;
    /**
     * MAC address, required for uniquely identifying lights added to a bridge
     */
    mac: string;
    /**
     * A name for the light
     */
    name: string;
    /**
     * ID of a room the light belongs to
     */
    room: string;
    /**
     * Serial number printed on the light, recommended for searching for missing lights
     */
    serial?: string;
    /**
     * If the light is controlled by a smart plug
     */
    "smart-plug"?: boolean;
    /**
     * The type of light. See 'archetype' here:
     * https://developers.meethue.com/develop/hue-api-v2/api-reference/#resource_light_get
     */
    type?: LightType;
    /**
     * A list of zones the light belongs to
     */
    zones?: string[];
}

/**
 * The type of light. See 'archetype' here:
 * https://developers.meethue.com/develop/hue-api-v2/api-reference/#resource_light_get
 */
export enum LightType {
    Bollard = "bollard",
    CandleBulb = "candle_bulb",
    CeilingHorizontal = "ceiling_horizontal",
    CeilingRound = "ceiling_round",
    CeilingSquare = "ceiling_square",
    CeilingTube = "ceiling_tube",
    ChristmasTree = "christmas_tree",
    ClassicBulb = "classic_bulb",
    DoubleSpot = "double_spot",
    EdisonBulb = "edison_bulb",
    EllipseBulb = "ellipse_bulb",
    FlexibleLamp = "flexible_lamp",
    FloodBulb = "flood_bulb",
    FloorLantern = "floor_lantern",
    FloorShade = "floor_shade",
    GroundSpot = "ground_spot",
    HueBloom = "hue_bloom",
    HueCentris = "hue_centris",
    HueGo = "hue_go",
    HueIris = "hue_iris",
    HueLightstrip = "hue_lightstrip",
    HueLightstripPC = "hue_lightstrip_pc",
    HueLightstripTv = "hue_lightstrip_tv",
    HuePlay = "hue_play",
    HueSigne = "hue_signe",
    HueTube = "hue_tube",
    LargeGlobeBulb = "large_globe_bulb",
    LusterBulb = "luster_bulb",
    PendantLong = "pendant_long",
    PendantRound = "pendant_round",
    PendantSpot = "pendant_spot",
    Plug = "plug",
    RecessedCeiling = "recessed_ceiling",
    RecessedFloor = "recessed_floor",
    SingleSpot = "single_spot",
    SmallGlobeBulb = "small_globe_bulb",
    SpotBulb = "spot_bulb",
    StringLight = "string_light",
    SultanBulb = "sultan_bulb",
    TableShade = "table_shade",
    TableWash = "table_wash",
    TriangleBulb = "triangle_bulb",
    UnknownArchetype = "unknown_archetype",
    VintageBulb = "vintage_bulb",
    VintageCandleBulb = "vintage_candle_bulb",
    WallLantern = "wall_lantern",
    WallShade = "wall_shade",
    WallSpot = "wall_spot",
    WallWasher = "wall_washer",
}

export interface MotionSensor {
    comment?: string;
    /**
     * An ID of room or zone the motion sensor controls
     */
    group: string;
    /**
     * Uniquely identify the motion sensor in this configuration
     */
    id: string;
    /**
     * MAC address, required for uniquely identifying motion sensors added to a bridge
     */
    mac: string;
    /**
     * A name for the motion sensor
     */
    name: string;
    /**
     * Serial number printed on the motion sensor, recommended for searching for missing motion
     * sensors
     */
    serial?: string;
}

/**
 * A room
 */
export interface Room {
    comment?: string;
    /**
     * Uniquely identify the room in this configuration
     */
    id: string;
    /**
     * A name for the room
     */
    name: string;
    /**
     * The type of room. See 'archetype' here:
     * https://developers.meethue.com/develop/hue-api-v2/api-reference/#resource_room_get
     */
    type?: RoomType;
}

/**
 * The type of room. See 'archetype' here:
 * https://developers.meethue.com/develop/hue-api-v2/api-reference/#resource_room_get
 *
 * The type of zone. See 'archetype' here:
 * https://developers.meethue.com/develop/hue-api-v2/api-reference/#resource_zone_get
 */
export enum RoomType {
    Attic = "attic",
    Balcony = "balcony",
    Barbecue = "barbecue",
    Bathroom = "bathroom",
    Bedroom = "bedroom",
    Carport = "carport",
    Closet = "closet",
    Computer = "computer",
    Dining = "dining",
    Downstairs = "downstairs",
    Driveway = "driveway",
    FrontDoor = "front_door",
    Garage = "garage",
    Garden = "garden",
    GuestRoom = "guest_room",
    Gym = "gym",
    Hallway = "hallway",
    Home = "home",
    KidsBedroom = "kids_bedroom",
    Kitchen = "kitchen",
    LaundryRoom = "laundry_room",
    LivingRoom = "living_room",
    Lounge = "lounge",
    ManCave = "man_cave",
    Music = "music",
    Nursery = "nursery",
    Office = "office",
    Other = "other",
    Pool = "pool",
    Porch = "porch",
    Reading = "reading",
    Recreation = "recreation",
    Staircase = "staircase",
    Storage = "storage",
    Studio = "studio",
    Terrace = "terrace",
    Toilet = "toilet",
    TopFloor = "top_floor",
    Tv = "tv",
    Upstairs = "upstairs",
}

export interface TapDialSwitch {
    /**
     * Configuration for the first tap dial switch button
     */
    button1: TapDialSwitchButton1;
    /**
     * Configuration for the second tap dial switch button
     */
    button2: TapDialSwitchButton2;
    /**
     * Configuration for the third tap dial switch button
     */
    button3: TapDialSwitchButton3;
    /**
     * Configuration for the forth tap dial switch button
     */
    button4:  TapDialSwitchButton4;
    comment?: string;
    /**
     * Configuration for the dial
     */
    dial: Dial;
    /**
     * Uniquely identify the tap dial switch in this configuration
     */
    id: string;
    /**
     * MAC address, required for uniquely identifying tap dial switches added to a bridge
     */
    mac: string;
    /**
     * A name for the tap dial switch
     */
    name: string;
    /**
     * Serial number printed on the tap dial switch, recommended for searching for missing tap
     * dial switches
     */
    serial?: string;
}

/**
 * Configuration for the first tap dial switch button
 */
export interface TapDialSwitchButton1 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

/**
 * Configuration for the second tap dial switch button
 */
export interface TapDialSwitchButton2 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

/**
 * Configuration for the third tap dial switch button
 */
export interface TapDialSwitchButton3 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

/**
 * Configuration for the forth tap dial switch button
 */
export interface TapDialSwitchButton4 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

/**
 * Configuration for the dial
 */
export interface Dial {
    /**
     * An ID of room or zone the dial controls
     */
    group: string;
}

export interface WallSwitch {
    /**
     * Configuration for the first wall switch button
     */
    button1: WallSwitchButton1;
    /**
     * Configuration for the second wall switch button
     */
    button2?: WallSwitchButton2;
    comment?: string;
    /**
     * Uniquely identify the wall switch in this configuration
     */
    id: string;
    /**
     * MAC address, required for uniquely identifying wall switches added to a bridge
     */
    mac: string;
    /**
     * If the wall switch has one or two buttons
     */
    mode: Mode;
    /**
     * A name for the wall switch
     */
    name: string;
}

/**
 * Configuration for the first wall switch button
 */
export interface WallSwitchButton1 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

/**
 * Configuration for the second wall switch button
 */
export interface WallSwitchButton2 {
    /**
     * An ID of room or zone the button controls
     */
    group: string;
}

/**
 * If the wall switch has one or two buttons
 */
export enum Mode {
    SwitchDualRocker = "switch_dual_rocker",
    SwitchSingleRocker = "switch_single_rocker",
}

/**
 * A zone
 */
export interface Zone {
    comment?: string;
    /**
     * Uniquely identify the zone in this configuration
     */
    id: string;
    /**
     * A name for the zone
     */
    name: string;
    /**
     * The type of zone. See 'archetype' here:
     * https://developers.meethue.com/develop/hue-api-v2/api-reference/#resource_zone_get
     */
    type?: RoomType;
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toConfigGen(json: string): ConfigGen {
        return cast(JSON.parse(json), r("ConfigGen"));
    }

    public static configGenToJson(value: ConfigGen): string {
        return JSON.stringify(uncast(value, r("ConfigGen")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "ConfigGen": o([
        { json: "bridge", js: "bridge", typ: r("Bridge") },
        { json: "defaults", js: "defaults", typ: r("Defaults") },
        { json: "dimmer-switches", js: "dimmer-switches", typ: u(undefined, a(r("DimmerSwitch"))) },
        { json: "lights", js: "lights", typ: a(r("Light")) },
        { json: "motion-sensors", js: "motion-sensors", typ: u(undefined, a(r("MotionSensor"))) },
        { json: "name", js: "name", typ: u(undefined, "") },
        { json: "rooms", js: "rooms", typ: a(r("Room")) },
        { json: "tap-dial-switches", js: "tap-dial-switches", typ: u(undefined, a(r("TapDialSwitch"))) },
        { json: "wall-switches", js: "wall-switches", typ: u(undefined, a(r("WallSwitch"))) },
        { json: "zones", js: "zones", typ: u(undefined, a(r("Zone"))) },
    ], false),
    "Bridge": o([
        { json: "lat", js: "lat", typ: "" },
        { json: "long", js: "long", typ: "" },
    ], false),
    "Defaults": o([
        { json: "powerup-behavior", js: "powerup-behavior", typ: r("PowerupBehavior") },
        { json: "scenes", js: "scenes", typ: r("Scenes") },
    ], false),
    "Scenes": o([
        { json: "day", js: "day", typ: r("Scene") },
        { json: "motion-sensor-day", js: "motion-sensor-day", typ: u(undefined, r("Scene")) },
        { json: "motion-sensor-night", js: "motion-sensor-night", typ: u(undefined, r("Scene")) },
        { json: "night", js: "night", typ: r("Scene") },
    ], false),
    "Scene": o([
        { json: "brigthness", js: "brigthness", typ: 3.14 },
        { json: "color-temperature", js: "color-temperature", typ: r("ColorTemperature") },
        { json: "image-id", js: "image-id", typ: "" },
        { json: "name", js: "name", typ: "" },
    ], "any"),
    "ColorTemperature": o([
        { json: "mirek", js: "mirek", typ: 3.14 },
    ], false),
    "DimmerSwitch": o([
        { json: "button1", js: "button1", typ: r("DimmerSwitchButton1") },
        { json: "button2", js: "button2", typ: r("DimmerSwitchButton2") },
        { json: "button3", js: "button3", typ: r("DimmerSwitchButton3") },
        { json: "button4", js: "button4", typ: r("DimmerSwitchButton4") },
        { json: "comment", js: "comment", typ: u(undefined, "") },
        { json: "id", js: "id", typ: "" },
        { json: "mac", js: "mac", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "serial", js: "serial", typ: u(undefined, "") },
    ], false),
    "DimmerSwitchButton1": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "DimmerSwitchButton2": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "DimmerSwitchButton3": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "DimmerSwitchButton4": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "Light": o([
        { json: "comment", js: "comment", typ: u(undefined, "") },
        { json: "id", js: "id", typ: "" },
        { json: "mac", js: "mac", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "room", js: "room", typ: "" },
        { json: "serial", js: "serial", typ: u(undefined, "") },
        { json: "smart-plug", js: "smart-plug", typ: u(undefined, true) },
        { json: "type", js: "type", typ: u(undefined, r("LightType")) },
        { json: "zones", js: "zones", typ: u(undefined, a("")) },
    ], false),
    "MotionSensor": o([
        { json: "comment", js: "comment", typ: u(undefined, "") },
        { json: "group", js: "group", typ: "" },
        { json: "id", js: "id", typ: "" },
        { json: "mac", js: "mac", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "serial", js: "serial", typ: u(undefined, "") },
    ], false),
    "Room": o([
        { json: "comment", js: "comment", typ: u(undefined, "") },
        { json: "id", js: "id", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "type", js: "type", typ: u(undefined, r("RoomType")) },
    ], false),
    "TapDialSwitch": o([
        { json: "button1", js: "button1", typ: r("TapDialSwitchButton1") },
        { json: "button2", js: "button2", typ: r("TapDialSwitchButton2") },
        { json: "button3", js: "button3", typ: r("TapDialSwitchButton3") },
        { json: "button4", js: "button4", typ: r("TapDialSwitchButton4") },
        { json: "comment", js: "comment", typ: u(undefined, "") },
        { json: "dial", js: "dial", typ: r("Dial") },
        { json: "id", js: "id", typ: "" },
        { json: "mac", js: "mac", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "serial", js: "serial", typ: u(undefined, "") },
    ], false),
    "TapDialSwitchButton1": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "TapDialSwitchButton2": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "TapDialSwitchButton3": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "TapDialSwitchButton4": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "Dial": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "WallSwitch": o([
        { json: "button1", js: "button1", typ: r("WallSwitchButton1") },
        { json: "button2", js: "button2", typ: u(undefined, r("WallSwitchButton2")) },
        { json: "comment", js: "comment", typ: u(undefined, "") },
        { json: "id", js: "id", typ: "" },
        { json: "mac", js: "mac", typ: "" },
        { json: "mode", js: "mode", typ: r("Mode") },
        { json: "name", js: "name", typ: "" },
    ], false),
    "WallSwitchButton1": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "WallSwitchButton2": o([
        { json: "group", js: "group", typ: "" },
    ], false),
    "Zone": o([
        { json: "comment", js: "comment", typ: u(undefined, "") },
        { json: "id", js: "id", typ: "" },
        { json: "name", js: "name", typ: "" },
        { json: "type", js: "type", typ: u(undefined, r("RoomType")) },
    ], false),
    "PowerupBehavior": [
        "last_on_state",
        "powerfail",
        "safety",
    ],
    "LightType": [
        "bollard",
        "candle_bulb",
        "ceiling_horizontal",
        "ceiling_round",
        "ceiling_square",
        "ceiling_tube",
        "christmas_tree",
        "classic_bulb",
        "double_spot",
        "edison_bulb",
        "ellipse_bulb",
        "flexible_lamp",
        "flood_bulb",
        "floor_lantern",
        "floor_shade",
        "ground_spot",
        "hue_bloom",
        "hue_centris",
        "hue_go",
        "hue_iris",
        "hue_lightstrip",
        "hue_lightstrip_pc",
        "hue_lightstrip_tv",
        "hue_play",
        "hue_signe",
        "hue_tube",
        "large_globe_bulb",
        "luster_bulb",
        "pendant_long",
        "pendant_round",
        "pendant_spot",
        "plug",
        "recessed_ceiling",
        "recessed_floor",
        "single_spot",
        "small_globe_bulb",
        "spot_bulb",
        "string_light",
        "sultan_bulb",
        "table_shade",
        "table_wash",
        "triangle_bulb",
        "unknown_archetype",
        "vintage_bulb",
        "vintage_candle_bulb",
        "wall_lantern",
        "wall_shade",
        "wall_spot",
        "wall_washer",
    ],
    "RoomType": [
        "attic",
        "balcony",
        "barbecue",
        "bathroom",
        "bedroom",
        "carport",
        "closet",
        "computer",
        "dining",
        "downstairs",
        "driveway",
        "front_door",
        "garage",
        "garden",
        "guest_room",
        "gym",
        "hallway",
        "home",
        "kids_bedroom",
        "kitchen",
        "laundry_room",
        "living_room",
        "lounge",
        "man_cave",
        "music",
        "nursery",
        "office",
        "other",
        "pool",
        "porch",
        "reading",
        "recreation",
        "staircase",
        "storage",
        "studio",
        "terrace",
        "toilet",
        "top_floor",
        "tv",
        "upstairs",
    ],
    "Mode": [
        "switch_dual_rocker",
        "switch_single_rocker",
    ],
};
