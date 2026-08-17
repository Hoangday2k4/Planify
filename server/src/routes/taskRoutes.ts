import { Router } from 'express';
import { 
  getTasks, 
  createTask, 
  updateTask, 
  deleteTask, 
  createSubtask, 
  toggleSubtask, 
  deleteSubtask,
  getComments,
  createComment,
  getTaskMembers,
  addTaskMember,
  updateTaskMemberRole,
  deleteTaskMember,
  getTaskActivityLogs
} from '../controllers/taskController';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

router.use(authenticateJWT as any);

// Task endpoints
router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

// Subtask endpoints
router.post('/:taskId/subtasks', createSubtask);
router.patch('/subtasks/:subtaskId/toggle', toggleSubtask);
router.delete('/subtasks/:subtaskId', deleteSubtask);

// Comment endpoints
router.get('/:taskId/comments', getComments);
router.post('/:taskId/comments', createComment);

// Member endpoints
router.get('/:taskId/members', getTaskMembers);
router.post('/:taskId/members', addTaskMember);
router.put('/:taskId/members/:memberId', updateTaskMemberRole);
router.delete('/:taskId/members/:memberId', deleteTaskMember);

// Activity Logs endpoint
router.get('/:taskId/activity-logs', getTaskActivityLogs);

export default router;
