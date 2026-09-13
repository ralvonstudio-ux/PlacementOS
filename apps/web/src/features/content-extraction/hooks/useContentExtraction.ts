import { useMutation } from '@tanstack/react-query';
import { contentExtractionApi } from '../api/content-extraction.api';

export const useExtractContent = () =>
  useMutation({ mutationFn: (file: File) => contentExtractionApi.extract(file) });
