import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ScanHistoryScreen from '../../screens/ScanHistoryScreen';
import scanService from '../../services/scanService';
// Not mocked: showAlert just writes the dialog into this store, so the test can
// read the real title/message/buttons and invoke them the way the host would.
import useAlertStore from '../../utils/alert';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MCIcon');
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Polyline: 'Polyline',
  Circle: 'Circle',
  Line: 'SvgLine',
}));

jest.mock('../../services/scanService', () => ({
  __esModule: true,
  default: {
    getHistory: jest.fn(),
    getScanStatus: jest.fn(),
    deleteScan: jest.fn().mockResolvedValue({}),
  },
}));

const FACE_SCANS = [
  { id: 'scan-1', scanType: 'face', status: 'completed', glowScore: 72, overallWellnessScore: 68, createdAt: '2026-08-01T09:00:00Z' },
  { id: 'scan-2', scanType: 'face', status: 'completed', glowScore: 55, overallWellnessScore: 60, createdAt: '2026-07-28T09:00:00Z' },
];

const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };

const flattenText = (node) => {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  return flattenText(node.children);
};

/** The rows' own delete buttons — the trash icons, not the long-press.
 *  Matched on the composite that still carries `onPress`; the host View it
 *  renders to keeps the label but handles presses through responder props. */
const deleteButtons = tree => {
  const matches = tree.root.findAll(
    node =>
      typeof node.props?.onPress === 'function' &&
      String(node.props?.accessibilityLabel || '').startsWith('Delete '),
    { deep: true },
  );
  // One row can match at more than one depth (TouchableOpacity forwards both
  // props down); keep one entry per distinct label.
  const seen = new Set();
  return matches.filter(node => {
    const label = node.props.accessibilityLabel;
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
};

describe('ScanHistoryScreen delete', () => {
  let tree;

  beforeEach(() => {
    jest.clearAllMocks();
    scanService.getHistory.mockResolvedValue({ scans: [...FACE_SCANS] });
    useAlertStore.setState({ visible: false, buttons: [] });
  });

  afterEach(() => {
    if (tree) {
      act(() => tree.unmount());
      tree = null;
    }
  });

  const render = async () => {
    await act(async () => {
      tree = renderer.create(
        <ScanHistoryScreen navigation={navigation} route={{ params: { scanType: 'face' } }} />,
      );
    });
    return tree;
  };

  const pressDelete = async (index = 0) => {
    const buttons = deleteButtons(tree);
    await act(async () => { buttons[index].props.onPress(); });
  };

  const alertButton = text =>
    useAlertStore.getState().buttons.find(b => b.text === text);

  it('offers a delete control on every row', async () => {
    await render();
    expect(deleteButtons(tree)).toHaveLength(FACE_SCANS.length);
  });

  it('names the selected scan in the confirmation', async () => {
    await render();
    await pressDelete(0);

    const state = useAlertStore.getState();
    expect(state.visible).toBe(true);
    expect(state.title).toBe('Delete this scan?');
    expect(state.message).toContain('face scan from');
    expect(state.buttons.map(b => b.text)).toEqual(['Cancel', 'Delete']);
  });

  it('deletes only the confirmed scan and drops it from the list', async () => {
    await render();
    await pressDelete(0);
    await act(async () => { await alertButton('Delete').onPress(); });

    expect(scanService.deleteScan).toHaveBeenCalledTimes(1);
    expect(scanService.deleteScan).toHaveBeenCalledWith('scan-1');

    // The other scan is untouched and still on screen.
    expect(deleteButtons(tree)).toHaveLength(1);
    expect(flattenText(tree.toJSON())).toContain('55');
  });

  it('deletes nothing when the confirmation is cancelled', async () => {
    await render();
    await pressDelete(0);
    await act(async () => { alertButton('Cancel').onPress?.(); });

    expect(scanService.deleteScan).not.toHaveBeenCalled();
    expect(deleteButtons(tree)).toHaveLength(FACE_SCANS.length);
  });

  it('keeps the row when the delete request fails', async () => {
    scanService.deleteScan.mockRejectedValueOnce(new Error('offline'));
    await render();
    await pressDelete(0);
    await act(async () => { await alertButton('Delete').onPress(); });

    expect(deleteButtons(tree)).toHaveLength(FACE_SCANS.length);
    expect(useAlertStore.getState().message).toContain('Could not delete this scan');
  });
});
