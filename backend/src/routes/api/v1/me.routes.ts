/**
 * /api/v1/me — Current actor profile and memberships.
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import { getCurrentActor } from '../../../application/me.app-service';
import { getHomeData } from '../../../application/home.app-service';
import { getQueueItems } from '../../../application/queue.app-service';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await getCurrentActor(req.ctx!);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Home aggregate — queue preview, active studies, recent activity
router.get('/home', requireAuth, async (req, res, next) => {
  try {
    const result = await getHomeData(req.ctx!);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Work queue — actionable items for the current actor
router.get('/queue', requireAuth, async (req, res, next) => {
  try {
    const result = await getQueueItems(req.ctx!);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
