import axiosClient from '../../api/axiosClient';

export async function listClasses(academicYearId) {
  const { data } = await axiosClient.get('/classes', {
    params: academicYearId ? { academicYearId } : {},
  });
  return data.data;
}

export async function createClass(payload) {
  const { data } = await axiosClient.post('/classes', payload);
  return data.data;
}

export async function updateClass(id, payload) {
  const { data } = await axiosClient.put(`/classes/${id}`, payload);
  return data.data;
}

export async function deleteClass(id) {
  await axiosClient.delete(`/classes/${id}`);
}

export async function listClassSubjects(classId) {
  const { data } = await axiosClient.get(`/classes/${classId}/subjects`);
  return data.data;
}

export async function addClassSubject(classId, payload) {
  const { data } = await axiosClient.post(`/classes/${classId}/subjects`, payload);
  return data.data;
}

export async function updateClassSubject(classId, subjectAssignmentId, payload) {
  const { data } = await axiosClient.put(`/classes/${classId}/subjects/${subjectAssignmentId}`, payload);
  return data.data;
}

export async function removeClassSubject(classId, subjectAssignmentId) {
  await axiosClient.delete(`/classes/${classId}/subjects/${subjectAssignmentId}`);
}

export async function listClassesWithStats({ academicYearId, classTeacherId, search } = {}) {
  const { data } = await axiosClient.get('/classes', {
    params: {
      withStats: 'true',
      ...(academicYearId ? { academicYearId } : {}),
      ...(classTeacherId ? { classTeacherId } : {}),
      ...(search ? { search } : {}),
    },
  });
  return data.data;
}

export async function bulkAssignSubjects(classIds, subjects) {
  const { data } = await axiosClient.post('/classes/bulk-assign-subjects', { classIds, subjects });
  return data.data;
}

export async function promoteStudents(sourceClassId, payload) {
  const { data } = await axiosClient.post(`/classes/${sourceClassId}/promote`, payload);
  return data.data;
}
