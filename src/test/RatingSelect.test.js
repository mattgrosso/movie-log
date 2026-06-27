import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RatingSelect from '@/components/RatingSelect.vue'

const OPTIONS = [
  { value: '0', label: '0 - Worst in class' },
  { value: '1', label: '1 - Among the worst in class' },
  { value: '2', label: '2 - Terrible' }
]

function factory (props = {}) {
  return mount(RatingSelect, {
    props: { label: 'Direction', name: 'direction', description: 'Desc here', options: OPTIONS, ...props }
  })
}

describe('RatingSelect', () => {
  it('renders the label, description, and links the label to the select via name/id', () => {
    const wrapper = factory()
    expect(wrapper.find('label').text()).toBe('Direction')
    expect(wrapper.find('label').attributes('for')).toBe('direction')
    expect(wrapper.find('p').text()).toBe('Desc here')
    const select = wrapper.find('select')
    expect(select.attributes('id')).toBe('direction')
    expect(select.attributes('name')).toBe('direction')
  })

  it('renders a leading empty option followed by the passed options', () => {
    const options = factory().findAll('option')
    expect(options.map((o) => o.element.value)).toEqual(['', '0', '1', '2'])
    expect(options.map((o) => o.text())).toEqual(['', ...OPTIONS.map((o) => o.label)])
  })

  it('reflects modelValue as the selected option', async () => {
    const wrapper = factory({ modelValue: '2' })
    expect(wrapper.find('select').element.value).toBe('2')
  })

  it('emits update:modelValue with the chosen string value on change', async () => {
    const wrapper = factory()
    await wrapper.find('select').setValue('1')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['1'])
  })

  it('shows the empty option when modelValue is null', () => {
    const wrapper = factory({ modelValue: null })
    expect(wrapper.find('select').element.value).toBe('')
  })
})
