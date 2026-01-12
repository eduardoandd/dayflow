import express from 'express'
import { dayflowController } from '../controllers/dayflowController'

const router = express.Router()
router.post('/dayflow', dayflowController)

export default router
