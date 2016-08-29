import test from 'ava';
import * as is from 'is-type-of';
import wrapper from './../../src/utils/wrapper';

test('Wrapper', (t) => {
  t.true(is.function(wrapper(() => {})));
});
