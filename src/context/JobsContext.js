import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { JOBS } from '../data/jobs';

const JobsContext = createContext(null);

const initialState = {
  jobs: JOBS,
  savedIds: JOBS.filter((j) => j.saved).map((j) => j.id),
  appliedIds: JOBS.filter((j) => j.applied).map((j) => j.id),
};

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_SAVE': {
      const id = action.payload;
      const isSaved = state.savedIds.includes(id);
      return {
        ...state,
        savedIds: isSaved ? state.savedIds.filter((s) => s !== id) : [...state.savedIds, id],
      };
    }
    case 'MARK_APPLIED': {
      const id = action.payload;
      if (state.appliedIds.includes(id)) return state;
      return { ...state, appliedIds: [...state.appliedIds, id] };
    }
    default:
      return state;
  }
}

export function JobsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const toggleSave = useCallback((id) => dispatch({ type: 'TOGGLE_SAVE', payload: id }), []);
  const markApplied = useCallback((id) => dispatch({ type: 'MARK_APPLIED', payload: id }), []);

  const enrichedJobs = state.jobs.map((j) => ({
    ...j,
    saved: state.savedIds.includes(j.id),
    applied: state.appliedIds.includes(j.id),
  }));

  return (
    <JobsContext.Provider value={{ jobs: enrichedJobs, toggleSave, markApplied }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error('useJobs must be used within JobsProvider');
  return ctx;
}
