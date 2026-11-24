import { useDispatch, useSelector } from 'react-redux';

/**
 * Pre-bound Redux hooks for the Se7enSquare app (Karmanya — Redux infrastructure).
 *
 * Instead of importing raw useDispatch / useSelector from react-redux everywhere,
 * all components should import from here. Benefits:
 *
 *   1. Single import path — if the store type or middleware ever changes, only
 *      this file needs updating, not every hook/component across all 5 tracks.
 *
 *   2. Prevents accidentally using the untyped useSelector and forgetting to
 *      pass a selector function.
 *
 *   3. Consistent code style enforced by ESLint (no-restricted-imports rule can
 *      ban direct react-redux imports in favour of this module).
 *
 * Usage:
 *   import { useAppDispatch, useAppSelector } from '../store/hooks';
 *   const dispatch = useAppDispatch();
 *   const user = useAppSelector((state) => state.auth.user);
 */

export const useAppDispatch = () => useDispatch();

export const useAppSelector = useSelector;
