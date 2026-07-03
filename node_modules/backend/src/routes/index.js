import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';


const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

router.use('/health', (await import('./health.routes.js')).default);
router.use('/doctors', (await import('./doctors.routes.js')).default);
router.use('/doctors', (await import('./doctors.register.multipart.routes.js')).default);
router.use('/appointments', (await import('./appointments.routes.js')).default);
router.use('/doctor', (await import('./doctor.actions.routes.js')).default);
router.use('/doctor', (await import('./doctor.stats.routes.js')).default);
router.use('/doctor', (await import('./doctor.cabinet.routes.js')).default);
router.use('/doctor/feedbacks', (await import('./doctor.feedbacks.routes.js')).default);
router.use('/doctor', (await import('./doctor.patients.routes.js')).default);

export default router;












