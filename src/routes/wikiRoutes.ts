import { Router } from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import { listWikiPages, getWikiPage, searchWiki } from '../controllers/wikiController';

const router = Router();

router.get('/pages',        authenticateToken, listWikiPages);
router.get('/pages/:path',  authenticateToken, getWikiPage);
router.get('/search',       authenticateToken, searchWiki);

export default router;
