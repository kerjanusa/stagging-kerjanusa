import { useState, useCallback } from 'react';
import JobService from '../services/jobService';

/**
 * Hide backend SQL errors behind a user-facing fallback message when needed.
 */
const getJobErrorMessage = (error, fallbackMessage) => {
  const message = typeof error === 'string' ? error : error?.message;

  if (!message || message.startsWith('SQLSTATE[')) {
    return fallbackMessage;
  }

  return message;
};

/**
 * Manage public and recruiter job state around the shared job service layer.
 */
const useJobs = () => {
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Mengambil daftar lowongan berdasarkan filter aktif lalu menyimpan hasil dan pagination ke state.
   */
  const fetchJobs = useCallback(async (filters = {}, page = 1, perPage = 15) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await JobService.getJobs(filters, page, perPage);
      setJobs(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(getJobErrorMessage(err, 'Gagal memuat lowongan. Periksa koneksi backend dan database.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mengambil satu lowongan berdasarkan id untuk halaman detail atau modal lanjutan.
   */
  const getJobById = useCallback(async (jobId) => {
    setIsLoading(true);
    setError(null);
    try {
      const job = await JobService.getJobById(jobId);
      return job;
    } catch (err) {
      setError(getJobErrorMessage(err, 'Gagal memuat detail lowongan.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mengirim payload pembuatan lowongan baru ke backend.
   */
  const createJob = useCallback(async (jobData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await JobService.createJob(jobData);
      return response;
    } catch (err) {
      setError(err.message || 'Failed to create job');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mengirim perubahan lowongan yang sudah ada ke backend.
   */
  const updateJob = useCallback(async (jobId, jobData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await JobService.updateJob(jobId, jobData);
      return response;
    } catch (err) {
      setError(err.message || 'Failed to update job');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Menghapus lowongan dan meneruskan respons backend ke caller.
   */
  const deleteJob = useCallback(async (jobId) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await JobService.deleteJob(jobId);
      return response;
    } catch (err) {
      setError(err.message || 'Failed to delete job');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mengambil daftar lowongan milik recruiter yang sedang login.
   */
  const getMyJobs = useCallback(async (page = 1, perPage = 15) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await JobService.getMyJobs(page, perPage);
      setJobs(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(getJobErrorMessage(err, 'Gagal memuat daftar lowongan Anda.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    jobs,
    pagination,
    isLoading,
    error,
    fetchJobs,
    getJobById,
    createJob,
    updateJob,
    deleteJob,
    getMyJobs,
  };
};

export default useJobs;
