import {test} from 'node:test';
import assert from 'node:assert/strict';
import {markerDimensions,defaultMarkerSize} from '../src/marker-sizes.js';
test('default emphasizes 46px housing and compact 16px infrastructure',()=>{assert.deepEqual(markerDimensions(defaultMarkerSize),{home:46,social:16,cluster:26});});
test('all size presets stay in requested ranges and selected housing grows 20 percent',()=>{for(const size of ['compact','standard','large']){const normal=markerDimensions(size),selected=markerDimensions(size,true);assert.ok(normal.home>=42&&normal.home<=48);assert.ok(normal.social>=14&&normal.social<=18);assert.equal(selected.home,normal.home*1.2);assert.equal(selected.social,normal.social);}});
