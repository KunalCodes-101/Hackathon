import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, getAnalysis } from '../api.js';

export function useAnalysis(id) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const socket = useMemo(
    () =>
      io(API_URL, {
        autoConnect: false,
        transports: ['websocket', 'polling']
      }),
    []
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const result = await getAnalysis(id);
        if (mounted) setAnalysis(result);
      } catch (err) {
        if (mounted) setError(err.response?.data?.error || err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    socket.connect();
    socket.emit('analysis:join', id);

    const update = ({ analysis: nextAnalysis }) => {
      setAnalysis(nextAnalysis);
    };

    socket.on('analysis:updated', update);
    socket.on('agent:update', update);
    socket.on('analysis:completed', update);
    socket.on('analysis:failed', update);

    return () => {
      mounted = false;
      socket.emit('analysis:leave', id);
      socket.off('analysis:updated', update);
      socket.off('agent:update', update);
      socket.off('analysis:completed', update);
      socket.off('analysis:failed', update);
      socket.disconnect();
    };
  }, [id, socket]);

  return { analysis, loading, error };
}
