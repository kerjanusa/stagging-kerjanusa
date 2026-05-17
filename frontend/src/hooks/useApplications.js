import { useState, useCallback } from 'react';
import ApplicationService from '../services/applicationService';

/**
 * Manage recruiter and candidate application state around the application service layer.
 */
const useApplications = () => {
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Submit one application and expose loading/error state to the caller.
   */
  const applyForJob = useCallback(
    async (jobId, coverLetter = '', screeningAnswers = [], videoIntroUrl = '') => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await ApplicationService.applyForJob(
          jobId,
          coverLetter,
          screeningAnswers,
          videoIntroUrl
        );
        return response;
      } catch (err) {
        setError(err.message || 'Failed to apply for job');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Load the current candidate's applications into local hook state.
   */
  const getMyApplications = useCallback(async (page = 1, perPage = 15) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ApplicationService.getMyApplications(page, perPage);
      setApplications(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to fetch applications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load applications for one recruiter-owned job into local hook state.
   */
  const getJobApplications = useCallback(async (jobId, page = 1, perPage = 15) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ApplicationService.getJobApplications(jobId, page, perPage);
      setApplications(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message || 'Failed to fetch applications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Persist a recruiter-driven application status or stage change.
   */
  const updateApplicationStatus = useCallback(async (applicationId, status, stage = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ApplicationService.updateApplicationStatus(
        applicationId,
        status,
        stage
      );
      return response;
    } catch (err) {
      setError(err.message || 'Failed to update application');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Withdraw one candidate-owned application and surface request state.
   */
  const withdrawApplication = useCallback(async (applicationId) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await ApplicationService.withdrawApplication(applicationId);
      return response;
    } catch (err) {
      setError(err.message || 'Failed to withdraw application');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    applications,
    pagination,
    isLoading,
    error,
    applyForJob,
    getMyApplications,
    getJobApplications,
    updateApplicationStatus,
    withdrawApplication,
  };
};

export default useApplications;
