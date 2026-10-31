import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markerDimensions,defaultMarkerSize} from '../src/marker-sizes.js';
test('default emphasizes 33px housing and visible 21px infrastructure',()=>{assert.deepEqual(markerDimensions(defaultMarkerSize),{home:33,social:21});});
test('all size presets stay in requested ranges and selected housing grows 20 percent',()=>{for(const size of ['compact','standard','large']){const normal=markerDimensions(size),selected=markerDimensions(size,true);assert.ok(normal.home>=32&&normal.home<=34);assert.ok(normal.social>=20&&normal.social<=22);assert.equal(selected.home,normal.home*1.2);assert.equal(selected.social,normal.social);}});
