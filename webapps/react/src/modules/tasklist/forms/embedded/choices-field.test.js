import { describe, expect, it } from 'vitest';
import ChoicesFieldHandler from './sdk/controls/choices-field-handler.js';
import VariableManager from './sdk/variable-manager.js';

/** The select of a form, bound to the String variable "category". */
function field(options, value) {
  const select = document.createElement('select');
  select.setAttribute('cam-variable-name', 'category');
  select.setAttribute('cam-variable-type', 'String');
  select.innerHTML = options;
  const variables = new VariableManager();
  const handler = new ChoicesFieldHandler(select, variables);
  if (value !== undefined) {
    variables.variableValue('category', value);
  }
  handler.applyValue();
  return { select, handler, variables };
}

const WITHOUT_VALUES = '<option>Travel Expenses</option><option>Misc</option>';
const WITH_VALUES = '<option value="travel">Travel Expenses</option><option value="misc">Misc</option>';

describe('select fields of embedded forms', () => {
  it('keeps the first option selected when the variable has no value, and submits it', () => {
    for (const noValue of [undefined, null]) {
      const { select, handler, variables } = field(WITHOUT_VALUES, noValue);

      expect(select.selectedIndex).toBe(0);
      expect(handler.getValue()).toBe('Travel Expenses');
      expect(variables.variableValue('category')).toBe('Travel Expenses');
    }
  });

  it('submits the text of the selected option when it has no value attribute', () => {
    const { select, handler } = field(WITHOUT_VALUES);
    select.selectedIndex = 1;

    expect(handler.getValue()).toBe('Misc');
  });

  it('submits the value attribute of the selected option', () => {
    const { select, handler } = field(WITH_VALUES);
    select.selectedIndex = 1;

    expect(handler.getValue()).toBe('misc');
  });

  it('selects the option of the variable value', () => {
    expect(field(WITHOUT_VALUES, 'Misc').select.selectedIndex).toBe(1);
    expect(field(WITH_VALUES, 'misc').select.selectedIndex).toBe(1);
  });

  it('leaves an explicit empty option selected when the variable has no value', () => {
    const { select, handler } = field('<option value="">Choose</option>' + WITH_VALUES);

    expect(select.selectedIndex).toBe(0);
    expect(handler.getValue()).toBe('');
  });
});
